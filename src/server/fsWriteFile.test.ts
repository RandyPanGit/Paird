import { describe, it, expect } from 'vitest'
import path from 'path'

describe('fs:write-file path traversal guard', () => {
  const projectPath = '/project/myapp'

  function isPathAllowed(reqPath: string): boolean {
    const resolved = path.resolve(reqPath)
    return resolved.startsWith(path.resolve(projectPath))
  }

  it('allows paths inside project', () => {
    expect(isPathAllowed('/project/myapp/README.md')).toBe(true)
    expect(isPathAllowed('/project/myapp/src/index.ts')).toBe(true)
  })

  it('blocks paths outside project', () => {
    expect(isPathAllowed('/etc/passwd')).toBe(false)
    expect(isPathAllowed('/project/myapp/../../../etc/passwd')).toBe(false)
    expect(isPathAllowed('/project/other/README.md')).toBe(false)
  })
})
