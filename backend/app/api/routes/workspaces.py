import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.schemas.workspaces import (
    MeResponse,
    WorkspaceResponse,
)

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=current_user.user_id, email=current_user.email)


@router.get("/workspaces/active", response_model=WorkspaceResponse)
async def get_active_workspace(
    current_user: CurrentUser = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = await _get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return WorkspaceResponse(**workspace)


@router.post("/workspaces/bootstrap", response_model=WorkspaceResponse)
async def bootstrap_workspace(
    current_user: CurrentUser = Depends(get_current_user),
) -> WorkspaceResponse:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Workspace bootstrap is manual in this private app",
    )


async def _get_first_workspace(
    current_user: CurrentUser,
) -> dict[str, object] | None:
    headers = _supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=_supabase_rest_url(), timeout=12) as client:
        membership_response = await client.get(
            "/workspace_members",
            headers=headers,
            params={
                "select": "workspace_id,role,created_at",
                "user_id": f"eq.{current_user.user_id}",
                "disabled_at": "is.null",
                "order": "created_at.asc",
                "limit": "1",
            },
        )
        _raise_supabase_error(membership_response)
        memberships = membership_response.json()

        if not memberships:
            return None

        membership = memberships[0]
        workspace_response = await client.get(
            "/workspaces",
            headers=headers,
            params={
                "select": "id,name,timezone,created_at",
                "id": f"eq.{membership['workspace_id']}",
                "archived_at": "is.null",
                "limit": "1",
            },
        )
        _raise_supabase_error(workspace_response)
        workspaces = workspace_response.json()

        if not workspaces:
            return None

        workspace = workspaces[0]
        return {
            "id": workspace["id"],
            "name": workspace["name"],
            "timezone": workspace["timezone"],
            "role": membership["role"],
            "created_at": workspace["created_at"],
        }


def _supabase_rest_url() -> str:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured",
        )

    return f"{settings.supabase_url.rstrip('/')}/rest/v1"


def _supabase_user_headers(access_token: str) -> dict[str, str]:
    if not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_ANON_KEY is not configured",
        )

    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {access_token}",
    }


def _raise_supabase_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Supabase request failed: {response.status_code} {response.text}",
    )
