import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import * as session from 'express-session';
import * as sharedsession from 'express-socket.io-session';
// import * as passport from 'passport';

import { Socket, Server } from 'socket.io';
import type { Handshake } from 'socket.io/dist/socket';
import { buildCors, buildSession } from 'src/config/auth';
import { NewCommentRequestDTO } from 'src/types';
import { CommentsUseCase } from '.';
import { UserAuthInfo } from '../auth';
import { Auth0Service } from '../auth0';
import type { RequestUser } from '../auth0/auth0.common';
import { Comment } from '../infrastructure/model';

interface CommentResponse {
  isDiscussionActive: boolean;
  comment: Comment;
}

type Gateway = OnGatewayInit & OnGatewayConnection;

@WebSocketGateway({
  cors: buildCors(),
})
@Injectable()
export class CommentsGateway implements Gateway {
  constructor(
    @Inject(forwardRef(() => CommentsUseCase))
    private readonly commentsUseCase: CommentsUseCase,
    private readonly authService: Auth0Service,
    private readonly configService: ConfigService,
  ) {}
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    const sessionRef = buildSession(this.configService);
    server.use(
      // @ts-expect-error types of Socket are not compatible, but I guess it's a version mismatch or some issue in the types of sharedSession.
      sharedsession(sessionRef, {
        autoSave: false,
        saveUninitialized: false,
      }),
    );
    return server;
  }

  async handleConnection(client: SocketWithoutUserYet) {
    try {
      if (!client.handshake.session.passport) {
        throw new WsException('Unauthorized');
      }
      const user = await this.authService.verify(
        client.handshake.session.passport?.user,
      );

      client.user = user;
    } catch (error: any) {
      // TODO throwing anything here now kills the app for some reason.
      // this catch is necessary — exceptions other than WsException force the server to fail while working with websockets
      client.disconnect(); // client.disconnect() and throwing WsException do almost the same thing, though WsException should be able to give verbose error messages to the client. I wasn't able to catch any verbose messages on the front-end yet.
    }
  }

  private validateSameUser(client: SocketWithUser, validateId: number) {
    if (client.user.id !== validateId) client.disconnect();
  }

  @SubscribeMessage('commentToServer')
  async handleMessage(
    @MessageBody()
    message: NewCommentRequestDTO,
    @ConnectedSocket() client: SocketWithUser,
  ): Promise<void> {
    console.log('client', client);
    if (message?.id) {
      const oldMessage = await this.commentsUseCase.getOneById(message.id);
      if (oldMessage.authorId !== client.user.id) {
        client.disconnect();
        return; // TODO add exceptions here, with alerts on front-end
      }
    }

    this.validateSameUser(client, message.userId);

    const newMessage: Comment = await this.commentsUseCase.createOrUpdate({
      value: message.value,
      userId: message.userId,
      accountInstanceId: message.accountInstanceId,
      date: message.date,
      commentType: message.commentType,
      id: message.id,
    });
    const newComment = await this.commentsUseCase.getOneById(newMessage.id);
    const response: CommentResponse = {
      isDiscussionActive: true,
      comment: newComment,
    };
    this.server.emit('commentToClient', response);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(client: Socket, room: string) {
    await client.join(room);
    client.emit('joinedRoom', room);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(client: Socket, room: string) {
    await client.leave(room);
    client.emit('leftRoom', room);
  }
}

interface SomethingWithUserAuthInfo {
  user: UserAuthInfo;
}
type SocketWithoutUserYet = Socket &
  Partial<SomethingWithUserAuthInfo> & {
    handshake: Handshake & {
      session: session.Session & {
        passport?: {
          user: RequestUser;
        };
      };
    };
  };
type SocketWithUser = Socket & SomethingWithUserAuthInfo;
