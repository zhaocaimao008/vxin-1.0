"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MomentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const moment_entity_1 = require("./entities/moment.entity");
const moments_service_1 = require("./moments.service");
const moments_controller_1 = require("./moments.controller");
let MomentsModule = class MomentsModule {
};
exports.MomentsModule = MomentsModule;
exports.MomentsModule = MomentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([moment_entity_1.Moment, moment_entity_1.MomentComment, moment_entity_1.MomentLike])],
        providers: [moments_service_1.MomentsService],
        controllers: [moments_controller_1.MomentsController],
        exports: [moments_service_1.MomentsService],
    })
], MomentsModule);
//# sourceMappingURL=moments.module.js.map