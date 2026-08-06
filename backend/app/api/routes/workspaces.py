from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.schemas.workspaces import (
    MeResponse,
    WorkspaceResponse,
)
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=current_user.user_id, email=current_user.email)


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


@router.post("/workspaces/bootstrap", response_model=WorkspaceResponse)
async def bootstrap_workspace(
    current_user: CurrentUser = Depends(get_current_user),
) -> WorkspaceResponse:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Workspace bootstrap is manual in this private app",
    )
