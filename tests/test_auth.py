from app.auth.jwt import hash_password, verify_password, create_token, decode_token


def test_password_roundtrip():
    h = hash_password("s3cret")
    assert verify_password("s3cret", h)
    assert not verify_password("wrong", h)


def test_token_roundtrip():
    token = create_token(user_id="a@b.com", role="agent")
    payload = decode_token(token)
    assert payload["sub"] == "a@b.com"
    assert payload["role"] == "agent"
