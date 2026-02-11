import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

@Injectable()
export default class PtnService {
  constructor() {}

  getAllPtn() {
    const filePath = path.join(process.cwd(), 'src/api/ptn/data/ptn.json');
    const files = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(files);
    return data;
  }
}
