import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.workspaces import (
    MeResponse,
    MeUpdateRequest,
    WorkspaceMemberItem,
    WorkspaceResponse,
)
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    display_name = await _get_display_name(current_user)
    return MeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        display_name=display_name,
    )


@router.patch("/me", response_model=MeResponse)
async def update_me(
    payload: MeUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> MeResponse:
    headers = {
        **supabase_user_headers(current_user.access_token),
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.post(
            "/profiles",
            headers=headers,
            params={"on_conflict": "user_id"},
            json={
                "user_id": str(current_user.user_id),
                "display_name": payload.display_name,
            },
        )
        raise_supabase_error(response)
        rows = response.json()

    display_name = rows[0]["display_name"] if rows else payload.display_name
    return MeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        display_name=display_name,
    )


@router.get("/workspaces/active", response_model=WorkspaceResponse)
async def get_active_workspace(
    current_user: CurrentUser = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return WorkspaceResponse(**workspace)


@router.get("/workspaces/members", response_model=list[WorkspaceMemberItem])
async def list_workspace_members(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[WorkspaceMemberItem]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    headers = supabase_user_headers(current_user.access_token)
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        members_response = await client.get(
            "/workspace_members",
            headers=headers,
            params={
                "select": "user_id",
                "workspace_id": f"eq.{workspace['id']}",
                "disabled_at": "is.null",
            },
        )
        raise_supabase_error(members_response)
        member_rows = members_response.json()

        user_ids = [row["user_id"] for row in member_rows]
        display_names: dict[str, str] = {}
        if user_ids:
            profiles_response = await client.get(
                "/profiles",
                headers=headers,
                params={
                    "select": "user_id,display_name",
                    "user_id": f"in.({','.join(user_ids)})",
                },
            )
            raise_supabase_error(profiles_response)
            display_names = {
                row["user_id"]: row["display_name"] for row in profiles_response.json()
            }

    return [
        WorkspaceMemberItem(
            user_id=row["user_id"],
            display_name=display_names.get(row["user_id"]),
        )
        for row in member_rows
    ]


@router.post("/workspaces/bootstrap", response_model=WorkspaceResponse)
async def bootstrap_workspace(
    current_user: CurrentUser = Depends(get_current_user),
) -> WorkspaceResponse:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Workspace bootstrap is manual in this private app",
    )


async def _get_display_name(current_user: CurrentUser) -> str | None:
    headers = supabase_user_headers(current_user.access_token)
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/profiles",
            headers=headers,
            params={
                "select": "display_name",
                "user_id": f"eq.{current_user.user_id}",
                "limit": "1",
            },
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        return None

    display_name = rows[0].get("display_name")
    return str(display_name) if display_name is not None else None
