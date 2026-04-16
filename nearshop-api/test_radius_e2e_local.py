import asyncio
import os
import time
from uuid import UUID

import httpx

from app.core.security import create_access_token

CUSTOMER_ID = UUID("11111111-1111-1111-1111-111111111111")
BUSINESS_ID = UUID("22222222-2222-2222-2222-222222222222")

CANDIDATE_BASE_URLS = [
    "http://127.0.0.1:8001/api/v1",
    "http://127.0.0.1:8000/api/v1",
    "http://165.232.182.130/api/v1",
]

CENTER_LAT = 12.9352
CENTER_LNG = 77.6245


def report(step: str, ok: bool, detail: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {step}: {detail}")


def build_auth_headers() -> tuple[dict, dict]:
    # Prefer externally supplied tokens when available.
    # This avoids local JWT secret mismatch when server was launched with different env.
    customer_token = os.getenv("NEARSHOP_CUSTOMER_TOKEN")
    business_token = os.getenv("NEARSHOP_BUSINESS_TOKEN")

    if not customer_token:
        customer_token = create_access_token({"sub": str(CUSTOMER_ID), "role": "customer"})
    if not business_token:
        business_token = create_access_token({"sub": str(BUSINESS_ID), "role": "business"})

    h_cust = {"Authorization": f"Bearer {customer_token}"}
    h_biz = {"Authorization": f"Bearer {business_token}"}
    return h_cust, h_biz


async def pick_base_url(client: httpx.AsyncClient) -> str | None:
    env_base = os.getenv("NEARSHOP_BASE_URL")
    candidates = [env_base] if env_base else []
    candidates.extend(CANDIDATE_BASE_URLS)

    for base in candidates:
        if not base:
            continue
        try:
            r = await client.get(f"{base}/health")
            if r.status_code == 200:
                return base
        except Exception:
            continue
    return None


async def create_shop(client: httpx.AsyncClient, base_url: str, headers: dict, payload: dict) -> tuple[str | None, int, str]:
    for attempt in range(1, 4):
        try:
            r = await client.post(f"{base_url}/shops", json=payload, headers=headers)
            if r.status_code not in (200, 201):
                return None, r.status_code, r.text
            return r.json().get("id"), r.status_code, r.text
        except httpx.ReadTimeout:
            if attempt == 3:
                return None, 408, "Read timeout while creating shop"
            await asyncio.sleep(0.5 * attempt)
    return None, 500, "Unexpected error while creating shop"


async def create_deal(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    shop_id: str,
    title: str,
    discount_pct: int,
) -> tuple[str | None, int, str]:
    payload = {
        "title": title,
        "description": "Radius E2E test deal",
        "discount_pct": discount_pct,
        "duration_hours": 24,
    }
    for attempt in range(1, 4):
        try:
            r = await client.post(f"{base_url}/deals", params={"shop_id": shop_id}, json=payload, headers=headers)
            if r.status_code not in (200, 201):
                return None, r.status_code, r.text
            return r.json().get("id"), r.status_code, r.text
        except httpx.ReadTimeout:
            if attempt == 3:
                return None, 408, "Read timeout while creating deal"
            await asyncio.sleep(0.5 * attempt)
    return None, 500, "Unexpected error while creating deal"


async def create_product(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    shop_id: str,
    name: str,
    category: str,
) -> tuple[str | None, int, str]:
    payload = {
        "name": name,
        "description": "Radius E2E test product",
        "price": 99,
        "category": category,
        "images": [],
    }
    for attempt in range(1, 4):
        try:
            r = await client.post(f"{base_url}/products", params={"shop_id": shop_id}, json=payload, headers=headers)
            if r.status_code not in (200, 201):
                return None, r.status_code, r.text
            return r.json().get("id"), r.status_code, r.text
        except httpx.ReadTimeout:
            if attempt == 3:
                return None, 408, "Read timeout while creating product"
            await asyncio.sleep(0.5 * attempt)
    return None, 500, "Unexpected error while creating product"


async def safe_cleanup(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    deal_ids: list[str],
    product_ids: list[str],
    shop_ids: list[str],
) -> None:
    for deal_id in deal_ids:
        try:
            await client.delete(f"{base_url}/deals/{deal_id}", headers=headers)
        except Exception:
            pass
    for product_id in product_ids:
        try:
            await client.delete(f"{base_url}/products/{product_id}", headers=headers)
        except Exception:
            pass
    for shop_id in shop_ids:
        try:
            await client.post(f"{base_url}/shops/{shop_id}/toggle-status", headers=headers)
        except Exception:
            pass


async def main() -> None:
    run_tag = str(int(time.time()))
    unique_category = f"radius_test_{run_tag}"

    h_cust, h_biz = build_auth_headers()

    shop_ids: list[str] = []
    deal_ids: list[str] = []
    product_ids: list[str] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        base_url = await pick_base_url(client)
        report("Resolve API base URL", base_url is not None, f"base_url={base_url}")
        if not base_url:
            return

        try:
            me = await client.get(f"{base_url}/auth/me", headers=h_cust)
            report("Customer auth token works", me.status_code == 200, f"status={me.status_code}")
            me_b = await client.get(f"{base_url}/auth/me", headers=h_biz)
            report("Business auth token works", me_b.status_code == 200, f"status={me_b.status_code}")
            if me.status_code != 200 or me_b.status_code != 200:
                if me.status_code == 401 or me_b.status_code == 401:
                    print("[HINT] Got 401 on /auth/me. JWT secret used by this script and running API do not match.")
                    print("[HINT] Either start API from nearshop-api so it loads .env, or pass tokens via NEARSHOP_CUSTOMER_TOKEN and NEARSHOP_BUSINESS_TOKEN.")
                return

            shop_specs = {
                "near_0km": {"lat": CENTER_LAT, "lng": CENTER_LNG, "category": unique_category},
                "near_1_2km": {"lat": CENTER_LAT + 0.0108, "lng": CENTER_LNG, "category": unique_category},
                "edge_4_8km": {"lat": CENTER_LAT + 0.0432, "lng": CENTER_LNG, "category": unique_category},
                "far_8km": {"lat": CENTER_LAT + 0.0720, "lng": CENTER_LNG, "category": unique_category},
                "other_category": {"lat": CENTER_LAT + 0.0090, "lng": CENTER_LNG + 0.0030, "category": "radius_test_other"},
            }

            created_names: dict[str, str] = {}
            for key, spec in shop_specs.items():
                name = f"Radius Test {key} {run_tag}"
                payload = {
                    "name": name,
                    "description": "Radius test shop",
                    "category": spec["category"],
                    "address": f"Radius Address {key}",
                    "latitude": spec["lat"],
                    "longitude": spec["lng"],
                    "delivery_options": ["pickup", "delivery"],
                    "delivery_radius": 5,
                }
                shop_id, status, body = await create_shop(client, base_url, h_biz, payload)
                ok = shop_id is not None
                report(f"Create shop {key}", ok, f"status={status}")
                if not ok:
                    report(f"Create shop {key} body", False, body[:300])
                    return
                shop_ids.append(shop_id)
                created_names[key] = name

            near_product_name = f"Radius Product Near {run_tag}"
            far_product_name = f"Radius Product Far {run_tag}"
            near_product_id, ps1, _ = await create_product(
                client, base_url, h_biz, shop_ids[0], near_product_name, unique_category
            )
            far_product_id, ps2, _ = await create_product(
                client, base_url, h_biz, shop_ids[3], far_product_name, unique_category
            )
            if near_product_id:
                product_ids.append(near_product_id)
            if far_product_id:
                product_ids.append(far_product_id)
            report("Create near product", near_product_id is not None, f"status={ps1}")
            report("Create far product", far_product_id is not None, f"status={ps2}")

            if near_product_id and far_product_id:
                p2 = await client.get(
                    f"{base_url}/products/search",
                    params={
                        "q": run_tag,
                        "lat": CENTER_LAT,
                        "lng": CENTER_LNG,
                        "radius_km": 2,
                        "per_page": 100,
                    },
                )
                names_p2 = [item.get("name") for item in p2.json().get("items", [])] if p2.status_code == 200 else []
                p2_ok = p2.status_code == 200 and (near_product_name in names_p2) and (far_product_name not in names_p2)
                report("Products within 2km include near product only", p2_ok, f"status={p2.status_code}, names={names_p2}")

                p10 = await client.get(
                    f"{base_url}/products/search",
                    params={
                        "q": run_tag,
                        "lat": CENTER_LAT,
                        "lng": CENTER_LNG,
                        "radius_km": 10,
                        "per_page": 100,
                    },
                )
                names_p10 = [item.get("name") for item in p10.json().get("items", [])] if p10.status_code == 200 else []
                p10_ok = p10.status_code == 200 and (near_product_name in names_p10) and (far_product_name in names_p10)
                report("Products within 10km include near and far products", p10_ok, f"status={p10.status_code}, names={names_p10}")

            r2 = await client.get(
                f"{base_url}/shops/nearby",
                params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 2, "category": unique_category, "per_page": 100},
            )
            names_r2 = [item.get("name") for item in r2.json().get("items", [])] if r2.status_code == 200 else []
            expected_r2 = {created_names["near_0km"], created_names["near_1_2km"]}
            report("Shops within 2km include only near shops", r2.status_code == 200 and set(names_r2) == expected_r2, f"status={r2.status_code}, names={names_r2}")

            r5 = await client.get(
                f"{base_url}/shops/nearby",
                params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 5, "category": unique_category, "per_page": 100},
            )
            names_r5 = [item.get("name") for item in r5.json().get("items", [])] if r5.status_code == 200 else []
            expected_r5 = {created_names["near_0km"], created_names["near_1_2km"], created_names["edge_4_8km"]}
            report("Shops within 5km include edge and exclude far", r5.status_code == 200 and set(names_r5) == expected_r5, f"status={r5.status_code}, names={names_r5}")

            r10 = await client.get(
                f"{base_url}/shops/nearby",
                params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 10, "category": unique_category, "per_page": 100},
            )
            names_r10 = [item.get("name") for item in r10.json().get("items", [])] if r10.status_code == 200 else []
            expected_r10 = {
                created_names["near_0km"],
                created_names["near_1_2km"],
                created_names["edge_4_8km"],
                created_names["far_8km"],
            }
            report("Shops within 10km include all test-category shops", r10.status_code == 200 and set(names_r10) == expected_r10, f"status={r10.status_code}, names={names_r10}")

            if r10.status_code == 200:
                index_map = {name: idx for idx, name in enumerate(names_r10)}
                ordered = [created_names["near_0km"], created_names["near_1_2km"], created_names["edge_4_8km"], created_names["far_8km"]]
                sort_ok = all(index_map[ordered[i]] < index_map[ordered[i + 1]] for i in range(len(ordered) - 1))
                report("Shops are sorted by nearest distance", sort_ok, f"order={[n for n in names_r10 if n in ordered]}")

            page1 = await client.get(
                f"{base_url}/shops/nearby",
                params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 10, "category": unique_category, "page": 1, "per_page": 2},
            )
            page2 = await client.get(
                f"{base_url}/shops/nearby",
                params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 10, "category": unique_category, "page": 2, "per_page": 2},
            )
            p1 = [item.get("name") for item in page1.json().get("items", [])] if page1.status_code == 200 else []
            p2 = [item.get("name") for item in page2.json().get("items", [])] if page2.status_code == 200 else []
            pagination_ok = (
                page1.status_code == 200
                and page2.status_code == 200
                and page1.json().get("total") == 4
                and len(p1) == 2
                and len(p2) == 2
                and len(set(p1).intersection(set(p2))) == 0
            )
            report("Shops pagination across pages", pagination_ok, f"p1={p1}, p2={p2}")

            bad_radius_zero = await client.get(f"{base_url}/shops/nearby", params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 0})
            report("Shops nearby rejects radius=0", bad_radius_zero.status_code == 422, f"status={bad_radius_zero.status_code}")

            bad_radius_large = await client.get(f"{base_url}/shops/nearby", params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 51})
            report("Shops nearby rejects radius>50", bad_radius_large.status_code == 422, f"status={bad_radius_large.status_code}")

            bad_lat = await client.get(f"{base_url}/shops/nearby", params={"lat": 100, "lng": CENTER_LNG, "radius_km": 5})
            report("Shops nearby rejects invalid latitude", bad_lat.status_code == 422, f"status={bad_lat.status_code}")

            near_deal_id, s1, _ = await create_deal(client, base_url, h_biz, shop_ids[0], f"Radius Deal Near {run_tag}", 20)
            far_deal_id, s2, _ = await create_deal(client, base_url, h_biz, shop_ids[3], f"Radius Deal Far {run_tag}", 25)
            if near_deal_id:
                deal_ids.append(near_deal_id)
            if far_deal_id:
                deal_ids.append(far_deal_id)
            report("Create near deal", near_deal_id is not None, f"status={s1}")
            report("Create far deal", far_deal_id is not None, f"status={s2}")

            if near_deal_id and far_deal_id:
                d2 = await client.get(
                    f"{base_url}/deals/nearby",
                    params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 2, "category": unique_category, "per_page": 100},
                    headers=h_cust,
                )
                titles_d2 = [item.get("title") for item in d2.json().get("items", [])] if d2.status_code == 200 else []
                deals_r2_ok = d2.status_code == 200 and (f"Radius Deal Near {run_tag}" in titles_d2) and (f"Radius Deal Far {run_tag}" not in titles_d2)
                report("Deals within 2km include near deal only", deals_r2_ok, f"status={d2.status_code}, titles={titles_d2}")

                d10 = await client.get(
                    f"{base_url}/deals/nearby",
                    params={"lat": CENTER_LAT, "lng": CENTER_LNG, "radius_km": 10, "category": unique_category, "per_page": 100},
                    headers=h_cust,
                )
                titles_d10 = [item.get("title") for item in d10.json().get("items", [])] if d10.status_code == 200 else []
                deals_r10_ok = d10.status_code == 200 and set(titles_d10) == {f"Radius Deal Near {run_tag}", f"Radius Deal Far {run_tag}"}
                report("Deals within 10km include near and far deals", deals_r10_ok, f"status={d10.status_code}, titles={titles_d10}")

            profile_set_1 = await client.patch(f"{base_url}/auth/profile", json={"preferred_shop_radius_km": 1}, headers=h_cust)
            ok_set_1 = profile_set_1.status_code == 200 and float(profile_set_1.json().get("preferred_shop_radius_km", -1)) == 1.0
            report("Profile accepts preferred radius=1", ok_set_1, f"status={profile_set_1.status_code}")

            profile_set_50 = await client.patch(f"{base_url}/auth/profile", json={"preferred_shop_radius_km": 50}, headers=h_cust)
            ok_set_50 = profile_set_50.status_code == 200 and float(profile_set_50.json().get("preferred_shop_radius_km", -1)) == 50.0
            report("Profile accepts preferred radius=50", ok_set_50, f"status={profile_set_50.status_code}")

            profile_bad_low = await client.patch(f"{base_url}/auth/profile", json={"preferred_shop_radius_km": 0.5}, headers=h_cust)
            report("Profile rejects preferred radius<1", profile_bad_low.status_code == 422, f"status={profile_bad_low.status_code}")

            profile_bad_high = await client.patch(f"{base_url}/auth/profile", json={"preferred_shop_radius_km": 51}, headers=h_cust)
            report("Profile rejects preferred radius>50", profile_bad_high.status_code == 422, f"status={profile_bad_high.status_code}")
        finally:
            await safe_cleanup(client, base_url, h_biz, deal_ids, product_ids, shop_ids)


if __name__ == "__main__":
    asyncio.run(main())
