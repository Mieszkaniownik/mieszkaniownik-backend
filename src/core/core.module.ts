import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    JwtModule.register({
      secret: "mieszkaniownik-jwt-secret",
      signOptions: { expiresIn: "1h" },
    }),
  ],
  exports: [JwtModule],
})
export class CoreModule {}
