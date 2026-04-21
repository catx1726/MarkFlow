import 'rangy'

declare module 'rangy' {
  interface RangyStatic {
    init(): void
    createClassApplier(className: string, options?: any): RangyClassApplier
    createRange(doc?: Document | Window | HTMLIFrameElement): RangyRange
    getSelection(doc?: Document | Window | HTMLIFrameElement): RangySelection
    serializeRange(range: RangyRange, omitChecksum: boolean, root?: Node | undefined): string
    deserializeRange(serialized: string, root?: Node | undefined, doc?: Document | undefined): RangyRange
    serializeSelection(selection: RangySelection, omitChecksum: boolean, root?: Node | undefined): string
    deserializeSelection(serialized: string, root?: Node | undefined, win?: Window | undefined): void
  }
}

declare module 'rangy/lib/rangy-core' {
  import { RangyStatic } from 'rangy'
  const rangy: RangyStatic
  export default rangy
}

declare module 'rangy/lib/rangy-serializer'
declare module 'rangy/lib/rangy-classapplier'
