"""
서울시 지진대피소 현황.csv → locations 테이블 INSERT SQL 생성기
사용법:
  python scripts/import_locations.py
  → locations_insert.sql 파일 생성 후 DBeaver에서 실행
"""
import csv
import os
import sys

CSV_FILE = os.path.join(os.path.expanduser("~"), "Downloads", "서울시 지진대피소 현황.csv")
OUT_FILE  = os.path.join(os.path.dirname(__file__), "..", "locations_insert.sql")

# CSV 컬럼 인덱스
IDX_NAME    = 3   # 시설명
IDX_ADDRESS = 4   # 상세주소
IDX_LNG     = 6   # 경도
IDX_LAT     = 7   # 위도

def esc(s: str) -> str:
    """SQL 싱글쿼트 이스케이프"""
    return s.replace("'", "''")

def main():
    if not os.path.exists(CSV_FILE):
        print(f"파일을 찾을 수 없습니다: {CSV_FILE}")
        print("CSV_FILE 경로를 직접 수정하거나 파일을 해당 위치에 복사해 주세요.")
        sys.exit(1)

    rows = []
    encodings = ["cp949", "euc-kr", "utf-8-sig", "utf-8"]

    content = None
    for enc in encodings:
        try:
            with open(CSV_FILE, encoding=enc, errors="strict") as f:
                content = f.read()
            print(f"인코딩 감지: {enc}")
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if content is None:
        print("인코딩 자동 감지 실패 — cp949로 강제 시도")
        with open(CSV_FILE, encoding="cp949", errors="replace") as f:
            content = f.read()

    reader = csv.reader(content.splitlines())
    header = next(reader, None)
    print(f"헤더: {header}")

    for i, row in enumerate(reader, start=2):
        if len(row) <= max(IDX_NAME, IDX_ADDRESS, IDX_LNG, IDX_LAT):
            continue
        name    = row[IDX_NAME].strip()
        address = row[IDX_ADDRESS].strip()
        lng     = row[IDX_LNG].strip()
        lat     = row[IDX_LAT].strip()

        if not name or not lng or not lat:
            print(f"  행 {i} 건너뜀 (빈 값): {row}")
            continue

        rows.append(f"  ('{esc(name)}', '{esc(address)}', '{esc(lng)}', '{esc(lat)}')")

    if not rows:
        print("삽입할 행이 없습니다.")
        sys.exit(1)

    sql = (
        "-- 서울시 지진대피소 위치 데이터\n"
        "-- 생성: import_locations.py\n\n"
        "INSERT INTO locations (name, address, longitude, latitude)\nVALUES\n"
        + ",\n".join(rows)
        + "\nON CONFLICT DO NOTHING;\n"
    )

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(sql)

    abs_out = os.path.abspath(OUT_FILE)
    print(f"\n✓ {len(rows)}개 행 → {abs_out}")
    print("DBeaver에서 이 SQL 파일을 열어서 실행하면 됩니다.")

if __name__ == "__main__":
    main()
