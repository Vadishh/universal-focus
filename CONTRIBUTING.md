# Contributing to Universal Focus

Thanks for helping improve Universal Focus.

## Development setup

1. Clone or download the repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository folder.
5. Reload the extension after source changes, then reload the page being tested.

## Testing

Run the unit tests with:

```bash
npm test
```

Also test manually using `tests/manual-test.html` and at least one search site and one chat/editor site.

## Pull requests

- Keep the extension dependency-free unless a dependency is clearly justified.
- Do not collect or transmit webpage text or user input.
- Update the README when behavior or permissions change.
- Add or update tests for ranking changes.
- Keep permissions minimal.
