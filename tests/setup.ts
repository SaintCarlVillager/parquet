import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

process.env.SESSION_SECRET ??= "teste-segredo-com-mais-de-trinta-e-dois-caracteres";
process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
