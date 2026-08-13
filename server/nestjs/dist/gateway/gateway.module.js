"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const chat_gateway_1 = require("./chat.gateway");
const messages_module_1 = require("../modules/messages/messages.module");
const groups_module_1 = require("../modules/groups/groups.module");
let GatewayModule = class GatewayModule {
};
exports.GatewayModule = GatewayModule;
exports.GatewayModule = GatewayModule = __decorate([
    (0, common_1.Module)({
        imports: [
            messages_module_1.MessagesModule,
            groups_module_1.GroupsModule,
            jwt_1.JwtModule.register({ secret: process.env.JWT_SECRET || 'change_me' }),
        ],
        providers: [chat_gateway_1.ChatGateway],
        exports: [chat_gateway_1.ChatGateway],
    })
], GatewayModule);
//# sourceMappingURL=gateway.module.js.map