"""
instagrapi 세션 생성 스크립트
로컬에서 실행 → base64 출력 → GitHub Secret에 등록

사용법:
  python scripts/create_session.py
"""

import json
import base64
import getpass
import sys

from instagrapi import Client

USERNAME = "womandriverahhh.daily"


def main():
    cl = Client()
    cl.delay_range = [1, 3]

    password = getpass.getpass(f"Instagram 비밀번호 ({USERNAME}): ")

    try:
        cl.login(USERNAME, password)
        print("로그인 성공!")
    except Exception as e:
        print(f"로그인 실패: {e}")
        print("\n5분 후 다시 시도하세요 (Instagram rate limit)")
        sys.exit(1)

    # 세션을 JSON으로 추출
    settings = cl.get_settings()
    settings_json = json.dumps(settings)
    b64 = base64.b64encode(settings_json.encode("utf-8")).decode("utf-8")

    print("\n" + "=" * 50)
    print("GitHub Secret 등록 명령어:")
    print("=" * 50)
    print("\n아래 명령어를 PowerShell에서 실행하세요:\n")
    print(f'"{b64}" | gh secret set INSTAGRAM_SESSION')
    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
