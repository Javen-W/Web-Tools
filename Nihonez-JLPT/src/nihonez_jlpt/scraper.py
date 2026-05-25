from __future__ import annotations

from pathlib import Path

from playwright.sync_api import Page, sync_playwright


def capture_results_html(
    url: str,
    output_path: Path | None = None,
    *,
    storage_state_path: Path | None = None,
) -> str:
    if storage_state_path is not None and not storage_state_path.is_file():
        raise FileNotFoundError(f"Storage state file not found: {storage_state_path}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(storage_state=str(storage_state_path) if storage_state_path else None)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded")
        _raise_for_login_gate(page)
        _open_test_if_needed(page)
        _raise_for_login_gate(page)
        _submit_test(page)
        html = page.content()
        context.close()
        browser.close()

    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(html, encoding="utf-8")

    return html


def _open_test_if_needed(page: Page) -> None:
    if page.locator("#test-form").count():
        return

    start_link = page.locator('a[href*="start=test"]').first
    if start_link.count():
        start_link.click()
        page.wait_for_load_state("networkidle")
        return

    raise RuntimeError("Could not locate the Nihonez test form or a start-test link.")


def _raise_for_login_gate(page: Page) -> None:
    if page.locator(".take-test-login-required").count():
        raise RuntimeError(
            "Nihonez requires login for live capture. Export an authenticated Playwright storage state "
            "and rerun with --storage-state <path>, or render from a previously saved results HTML file."
        )


def _submit_test(page: Page) -> None:
    for _ in range(12):
        if page.locator(".answer-wrapper .explanation, .explanation-wrapper .explanation").count():
            return

        _select_first_visible_answers(page)

        next_section = page.locator("#next-section:visible").first
        if next_section.count() and next_section.is_enabled():
            next_section.click()
            page.wait_for_load_state("networkidle")
            continue

        submit_button = page.locator("#submit-test:visible").first
        if submit_button.count() and submit_button.is_enabled():
            submit_button.click()
            page.wait_for_load_state("networkidle")
            continue

        break

    if not page.locator(".answer-wrapper .explanation, .explanation-wrapper .explanation").count():
        raise RuntimeError("The Nihonez page did not expose explanations after submission.")


def _select_first_visible_answers(page: Page) -> None:
    radios = page.locator("input[type='radio']:not([disabled])")
    seen_names: set[str] = set()
    for index in range(radios.count()):
        radio = radios.nth(index)
        if not radio.is_visible():
            continue

        name = radio.get_attribute("name")
        if not name or name in seen_names:
            continue

        radio.check(force=True)
        seen_names.add(name)
