from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.schemas.common import APIResponse
from app.schemas.instrument_type import (
    InstrumentTypeCreate,
    InstrumentTypeResponse,
    InstrumentTypeUpdate,
)
from app.services.instrument_type_service import InstrumentTypeService

router = APIRouter(
    prefix="/instrument-types",
    tags=["Instrument Types"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=APIResponse)
def list_instrument_types(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    items = InstrumentTypeService.get_all(db, active_only=active_only)
    return APIResponse(
        data=[InstrumentTypeResponse.model_validate(item).model_dump() for item in items]
    )


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_instrument_type(
    data: InstrumentTypeCreate,
    db: Session = Depends(get_db),
):
    item = InstrumentTypeService.create(db, data)
    return APIResponse(
        data=InstrumentTypeResponse.model_validate(item).model_dump(),
        message="Instrumento criado com sucesso",
    )


@router.put("/{instrument_type_id}", response_model=APIResponse)
def update_instrument_type(
    instrument_type_id: UUID,
    data: InstrumentTypeUpdate,
    db: Session = Depends(get_db),
):
    item = InstrumentTypeService.update(db, instrument_type_id, data)
    return APIResponse(
        data=InstrumentTypeResponse.model_validate(item).model_dump(),
        message="Instrumento atualizado",
    )


@router.delete("/{instrument_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instrument_type(
    instrument_type_id: UUID,
    db: Session = Depends(get_db),
):
    InstrumentTypeService.delete(db, instrument_type_id)
