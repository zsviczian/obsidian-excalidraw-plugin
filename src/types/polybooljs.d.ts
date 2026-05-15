declare module "polybooljs" {
  interface PolyBoolStatic {
    epsilon(value: number): void;
  }

  const PolyBool: PolyBoolStatic;
  export default PolyBool;
}
