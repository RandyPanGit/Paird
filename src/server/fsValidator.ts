import fs from 'fs/promises'
import path from 'path'
import { simpleGit } from 'simple-git'
import type { ValidatePathResult } from '../shared/types'

export async function validatePath(p: string): Promise<ValidatePathResult> {
  const projectName = path.basename(p)

  let stat
  try {
    stat = await fs.stat(p)
  } catch {
    return { exists: false, isDirectory: false, isGitRepo: false, projectName }
  }

  if (!stat.isDirectory()) {
    return { exists: true, isDirectory: false, isGitRepo: false, projectName }
  }

  let isGitRepo = false
  try {
    isGitRepo = await simpleGit(p).checkIsRepo()
  } catch {
    isGitRepo = false
  }

  return { exists: true, isDirectory: true, isGitRepo, projectName }
}
