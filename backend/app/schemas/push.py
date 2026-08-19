from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    user_agent: str | None = None
    device_label: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class VapidKeyResponse(BaseModel):
    public_key: str


class NotificationPreferencesItem(BaseModel):
    workspace_id: UUID
    user_id: UUID
    master_enabled: bool
    daily_plan_enabled: bool
    morning_time: time
    timezone: str
    created_at: datetime
    updated_at: datetime


class NotificationPreferencesUpdate(BaseModel):
    master_enabled: bool | None = None
    daily_plan_enabled: bool | None = None
    morning_time: time | None = None


class TestNotificationRequest(BaseModel):
    title: str = "Nenech mě chcípnout!"
    body: str = "Testovací notifikace dorazila."
