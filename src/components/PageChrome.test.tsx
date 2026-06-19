import { render, screen } from "@testing-library/react";
import { PageChromeProvider, usePageTitle, useSetPageTitle } from "./PageChrome";

function Setter() {
  useSetPageTitle("Anjali Menon");
  return null;
}
function Display() {
  return <span data-testid="title">{usePageTitle()}</span>;
}

test("a page can set the title and the bar reads it", () => {
  render(
    <PageChromeProvider>
      <Display />
      <Setter />
    </PageChromeProvider>,
  );
  expect(screen.getByTestId("title")).toHaveTextContent("Anjali Menon");
});
