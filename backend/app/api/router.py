from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.kytky import router as kytky_router
from app.api.routes.places import router as places_router
from app.api.routes.weather import router as weather_router
from app.api.routes.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(kytky_router)
api_router.include_router(places_router)
api_router.include_router(weather_router)
api_router.include_router(workspaces_router)
