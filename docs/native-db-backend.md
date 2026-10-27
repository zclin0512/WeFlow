# Native WCDB backend

Windows x64 builds use `resources/native-db/win32/x64/weflow_wcdb.dll`, a read-only Rust implementation of the WCDB C ABI used by `electron/services/wcdbCore.ts`. It opens WeChat 4.x SQLCipher databases and contains no vendor reporting endpoint or reporting implementation.

This project is based on [hicccc77/WeFlow](https://github.com/hicccc77/WeFlow). The Rust database layer is derived from [334456777/WeFlow](https://github.com/334456777/WeFlow), commit `2f804b806f66acaa09ffac6380a7c4b9385f44b8`, under the repository's CC BY-NC-SA 4.0 license. The unused image-key acquisition entry point and its dependency on the larger `weflow-core` crate are omitted here.

The backend supports database reads. Operations that modify WeChat databases (message edits/inserts/deletes, triggers, read marks, Moment deletion, and table imports) are unavailable or return a read-only error. A few optional helpers are not exported (`wcdb_purge_memory`, `wcdb_insert_text_message`, `wcdb_reorder_sessions_by_time`, `wcdb_set_message_cursor_projection`, and `wcdb_ai_query_session_candidates`); the Electron service already binds these optionally. `VerifyUser` is also not exported.

To rebuild on Windows x64, install Rust 1.99.1 and the matching Windows linker, then run:

```powershell
npm run native-db:build
```

Cross builds can set `WEFLOW_NATIVE_TARGET=x86_64-pc-windows-gnu` and provide a MinGW-compatible linker and C compiler. The resulting DLL is copied into `resources/native-db/win32/x64/` and included by the existing `extraResources` packaging rule.
