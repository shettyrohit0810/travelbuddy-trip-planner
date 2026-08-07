import logging
import sys
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.v1.api import api_router
from app.api.v1.endpoints.health import health_check
from app.middleware.error_handler import ErrorHandlingMiddleware
from app.core.database import engine, Base
from app.models import User, UserMemory, Trip

# Schema is owned by Alembic (`alembic upgrade head`), NOT by create_all().
#
# create_all() used to run here, which is why this project had migrations that
# could never apply: the app raced ahead and built the tables itself, so a later
# `alembic upgrade head` hit "relation already exists" and any migration that
# altered a column silently never ran against a database the app had already
# shaped. One owner of the schema, and it has to be the one with a version
# history. Run migrations before starting the app -- see the entrypoint below and
# the README.


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("app.main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Add custom global error handling middleware
app.add_middleware(ErrorHandlingMiddleware)

# Include versioned API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Direct /health endpoint for docker-compose healthchecks / convenience
@app.get("/health", tags=["health"])
def direct_health(db: Session = Depends(health_check)):
    return db
