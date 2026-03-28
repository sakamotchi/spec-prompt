import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'
import { TreePanel } from '../TreePanel'

export function AppLayout() {
  return (
    <div className="flex h-full w-full bg-[var(--color-bg-base)]">
      <SplitPane direction="horizontal" defaultSize={240} minSize={160} maxSize={480}>
        <TreePanel />
        <MainArea />
      </SplitPane>
    </div>
  )
}
