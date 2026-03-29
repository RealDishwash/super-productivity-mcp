#!/usr/bin/env node

import { createProgram } from "./cli/create-program.js";

const program = createProgram();
program.parse(process.argv);
