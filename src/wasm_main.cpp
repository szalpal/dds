/*
   DDS, a bridge double dummy solver.

   Emscripten entry point: provides the mandatory main() symbol so that
   emcc can link the static dds library into a .js / .wasm module.
   Actual library initialisation happens via the USES_CONSTRUCTOR path
   in dds.cpp (the __attribute__((constructor)) is supported by emcc).
*/

int main()
{
  return 0;
}
