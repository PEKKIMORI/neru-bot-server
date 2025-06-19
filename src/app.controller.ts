import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getBanana(): string {
    return this.appService.getBanana();
  }

  @Get("hello")
  getHello(): string {
    return this.appService.getHello();
  }
}
