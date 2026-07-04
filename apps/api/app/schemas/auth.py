from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "user"
