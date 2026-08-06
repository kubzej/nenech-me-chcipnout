import httpx

from app.core.auth import CurrentUser
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)


async def get_first_workspace(current_user: CurrentUser) -> dict[str, object] | None:
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
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
        raise_supabase_error(membership_response)
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
        raise_supabase_error(workspace_response)
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
