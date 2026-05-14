# Merging JJ Workspaces into Main

This document describes how to merge multiple JJ workspaces into a single linear history on main.

## When to Use This Workflow

Use this workflow when you have:
- Multiple JJ workspaces with independent development branches
- Work that needs to be consolidated into a single linear history
- Commits in different workspaces that you cannot directly rebase (causes stale workspace errors)

## Strategy: Duplicate + Rebase

JJ does not allow rebasing commits that belong to other workspaces (it causes stale workspace errors). The workaround is:

1. **Duplicate** commits from other workspaces into the current workspace
2. **Rebase** the duplicated copies into a linear chain
3. **Move main** bookmark to the final merged commit
4. **Create new empty change** on top for continued work

## Step-by-Step Instructions

### 1. Survey the Current State

First, understand your workspace structure:

```bash
# List all workspaces
jj workspace list

# View all commits with their workspace affiliations
jj log --ignore-working-copy -r 'all()' --no-graph
```

### 2. Identify Commits to Merge

For each workspace, identify the commit range to include (excluding empty working copies):

```bash
# Check ancestry for a workspace's commits
jj log --ignore-working-copy -r 'ancestors(<workspace-working-copy>, N)' --no-graph
```

### 3. Duplicate Commits from Other Workspaces

Duplicate the commits you want to merge. JJ will output the new change IDs:

```bash
# Duplicate a commit range
jj duplicate <start>::<end>

# Example: Duplicate commits from first to last non-empty commit
jj duplicate oysxvorl::munqmoxq
```

**Important**: Only duplicate commits that are NOT in your current workspace. Commits in the current workspace can be rebased directly.

### 4. Rebase into Linear Chain

Rebase commits to create a linear history:

```bash
# Rebase a commit chain onto a destination
jj rebase -s <first-commit-in-chain> -d <destination>
```

If conflicts occur:
1. Create a new commit on top of the first conflicted commit: `jj new <conflicted-commit>`
2. Resolve conflicts in the files
3. Squash the resolution: `jj squash`
4. Repeat for any remaining conflicted descendants

### 5. Move Main Bookmark

Once you have a linear chain:

```bash
jj bookmark set main -r <final-merged-commit>
```

### 6. Create New Working Change

```bash
jj new main
```

## Example Session

```bash
# Starting state:
# main (smlqklxl)
# ├── jj-stack-2: xoqntywy → tqqytsoq → @ (Electron app)
# ├── default: mkllukrx → rxvkznzx → nykoolmv → ltullnxy → nyzoomly@
# │   ├── jj-stack-3: oysxvorl → wopspvrk → munqmoxq → @
# │   └── jj-stack-4: pwuxnyqm → zsmptwlv → msvtlwtl → @
# └── wzswlkzo (E2E testing - standalone)

# Step 1: Rebase current workspace commits onto main
jj rebase -s xoqntywy -d main

# Step 2: Duplicate commits from other workspaces
jj duplicate mkllukrx::ltullnxy  # default workspace (excluding WIP)
jj duplicate oysxvorl::munqmoxq  # jj-stack-3
jj duplicate pwuxnyqm::msvtlwtl  # jj-stack-4
jj duplicate wzswlkzo            # standalone commit

# Step 3: Rebase duplicates into linear chain
# (using the new change IDs from duplicate output)
jj rebase -s <dup-default-first> -d tqqytsoq
jj rebase -s <dup-stack3-first> -d <dup-default-last>
jj rebase -s <dup-stack4-first> -d <dup-stack3-last>
jj rebase -s <dup-e2e> -d <dup-stack4-last>

# Step 4: Resolve any conflicts
jj new <conflicted-commit>
# ... edit files to resolve ...
jj squash

# Step 5: Move main bookmark
jj bookmark set main -r <final-commit>

# Step 6: Create new working change
jj new main
```

## Conflict Resolution Tips

1. **Identify conflict type**: Use `jj resolve --list` to see conflicted files
2. **Understand the conflict format**:
   - `+++++++ <commit>` = one side of the conflict
   - `%%%%%%% diff from: ... to: ...` = shows what's being applied
   - Both sides may contain code you want to keep
3. **Merge both sides**: Often conflicts arise because both branches added valid code. Combine both additions.
4. **Squash immediately**: After resolving, `jj squash` moves the resolution into the conflicted commit

## Troubleshooting

### "Stale workspace" Error

This happens when trying to rebase commits belonging to another workspace. Solution: Use `jj duplicate` first, then rebase the duplicates.

### Conflicted Descendants Auto-resolve

When you squash a conflict resolution, JJ automatically re-evaluates descendant commits. Sometimes conflicts in descendants resolve automatically.

### Finding Change IDs After Duplicate

The `jj duplicate` command outputs the new change IDs. Keep track of these for the rebase steps.

### Verifying Final Chain

```bash
# View the complete chain from main
jj log --ignore-working-copy -r 'main::@' --no-graph
```
