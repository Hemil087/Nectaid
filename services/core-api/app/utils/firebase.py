from __future__ import annotations

import logging
import os

import firebase_admin
from firebase_admin import credentials


logger = logging.getLogger(__name__)


def init_firebase_admin():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    sa_path = os.getenv("FIREBASE_SA")

    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        logger.info("Initializing Firebase Admin SDK from FIREBASE_SA")
    else:
        cred = credentials.ApplicationDefault()
        logger.info("Initializing Firebase Admin SDK from Application Default Credentials")

    return firebase_admin.initialize_app(cred)
