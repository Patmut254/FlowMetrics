import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """
    Normalise every error response to the same shape:

        {"detail": "Human readable summary", "errors": {"field": ["msg"]}}
    """
    if isinstance(exc, DjangoValidationError):
        return Response(
            {"detail": "Validation failed.", "errors": {"non_field_errors": exc.messages}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if isinstance(exc, IntegrityError):
        logger.warning("Integrity error: %s", exc)
        return Response(
            {"detail": "This record conflicts with existing data."},
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"detail": "Something went wrong on our side. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    if isinstance(data, dict) and set(data.keys()) == {"detail"}:
        response.data = {"detail": str(data["detail"])}
    elif isinstance(data, dict):
        errors = {key: value if isinstance(value, list) else [value] for key, value in data.items()}
        first = next(iter(errors.values()), ["Validation failed."])
        summary = str(first[0]) if first else "Validation failed."
        response.data = {"detail": summary, "errors": errors}
    elif isinstance(data, list):
        response.data = {"detail": str(data[0]) if data else "Validation failed.", "errors": {"non_field_errors": data}}
    return response
