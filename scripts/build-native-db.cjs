const { spawnSync } = require('child_process')
const { copyFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const targetOverride = process.env.WEFLOW_NATIVE_TARGET
const rustc = spawnSync('rustc', ['-vV'], { cwd: root, encoding: 'utf8' })

if (rustc.status !== 0) {
  process.stderr.write(rustc.stderr || 'Rust toolchain not found. Install Rust 1.99.1 first.\n')
  process.exit(rustc.status || 1)
}

const hostTarget = rustc.stdout.match(/^host: (.+)$/m)?.[1]
const target = targetOverride || hostTarget

if (target !== 'x86_64-pc-windows-msvc' && target !== 'x86_64-pc-windows-gnu') {
  process.stderr.write(`Unsupported native WCDB target: ${target || '(unknown)'}. Use x86_64-pc-windows-msvc or x86_64-pc-windows-gnu.\n`)
  process.exit(1)
}

const cargoArgs = ['build', '--release', '-p', 'weflow-wcdb-ffi', '--target', target]
const build = spawnSync('cargo', cargoArgs, { cwd: root, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status || 1)

const builtDll = join(root, 'target', target, 'release', 'weflow_wcdb.dll')
const outputDir = join(root, 'resources', 'native-db', 'win32', 'x64')
const outputDll = join(outputDir, 'weflow_wcdb.dll')
mkdirSync(outputDir, { recursive: true })
copyFileSync(builtDll, outputDll)
process.stdout.write(`Built ${outputDll}\n`)
