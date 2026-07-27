from typing import Optional


class HTTPError(Exception):
    def __init__(self, status_code: int, message: str, code: Optional[str] = None):
        self.status_code = status_code
        self.message = message
        # Machine-readable error code (e.g. "MILESTONES_INCOMPLETE") the
        # frontend can map to specific UI behavior; optional.
        self.code = code
        super().__init__(message)
