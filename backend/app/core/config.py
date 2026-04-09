from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str

    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-1.5-flash"

    SESSION_TIMEOUT_MINUTES: int = 30
    MAX_REQUESTS_PER_MINUTE: int = 5

    class Config:
        env_file = "../.env"


settings = Settings()
