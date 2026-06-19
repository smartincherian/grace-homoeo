import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface Chrome {
  title: string;
  setTitle: (t: string) => void;
}
const PageChromeContext = createContext<Chrome>({
  title: "",
  setTitle: () => {},
});

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return (
    <PageChromeContext.Provider value={{ title, setTitle }}>
      {children}
    </PageChromeContext.Provider>
  );
}

export function usePageTitle(): string {
  return useContext(PageChromeContext).title;
}

export function useSetPageTitle(title: string): void {
  const { setTitle } = useContext(PageChromeContext);
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
}
