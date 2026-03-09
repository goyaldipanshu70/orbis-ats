import logging
import json
import sys
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for consistent machine-readable output."""

    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "message": record.getMessage(),
            "module": record.module,
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)


def setup_logging(service_name: str) -> logging.Logger:
    """Configure and return a structured JSON logger for the given service."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter(service_name))

    logger = logging.getLogger(service_name)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    # Prevent duplicate log entries if setup_logging is called multiple times
    logger.propagate = False
    return logger
