from fastapi import APIRouter

from app.api.routes.absences import router as absences_router
from app.api.routes.care_events import router as care_events_router
from app.api.routes.care_profiles import router as care_profiles_router
from app.api.routes.care_tasks import router as care_tasks_router
from app.api.routes.health import router as health_router
from app.api.routes.kytky import router as kytky_router
from app.api.routes.places import router as places_router
from app.api.routes.plant_photos import router as plant_photos_router
from app.api.routes.weather import router as weather_router
from app.api.routes.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(absences_router)
api_router.include_router(care_events_router)
api_router.include_router(care_profiles_router)
api_router.include_router(care_tasks_router)
api_router.include_router(health_router)
api_router.include_router(kytky_router)
api_router.include_router(places_router)
api_router.include_router(plant_photos_router)
api_router.include_router(weather_router)
api_router.include_router(workspaces_router)
