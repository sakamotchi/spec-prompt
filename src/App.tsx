import { TerminalPanel } from "./components/TerminalPanel/TerminalPanel";

function App() {
  return (
    <div className="flex h-full bg-[#1e1e1e]">
      {/* Phase 0 POC: ターミナル単体表示 */}
      <div className="flex-1 p-2">
        <TerminalPanel cwd="/" />
      </div>
    </div>
  );
}

export default App;
