import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Req,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateCommentRequestDTO,
  EmptyResponseDTO,
  OneCommentResponseDTO,
} from 'src/types';
import { AuthedRequest, ManagerOrSeniorOnly } from '../auth';
import { CommentsUseCase } from './comments.useCase';

@ApiTags('comments')
@Controller('/api')
export class CommentsController {
  constructor(private readonly commentsUseCase: CommentsUseCase) {}

  @Get('/getAllComments')
  async getAllComments() {
    const comments = await this.commentsUseCase.getAll();
    return {
      response: {
        comments,
      },
    };
  }

  @Post('/createComment')
  @ManagerOrSeniorOnly()
  async createComment(
    @Req() { user }: AuthedRequest,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    {
      id,
      value,
      accountInstanceId,
      date,
      commentType,
    }: CreateCommentRequestDTO,
  ): Promise<EmptyResponseDTO> {
    this.commentsUseCase.checkAvailabilityToMakeCommentsFor(user);
    await this.commentsUseCase.createOrUpdate({
      id,
      value,
      userId: user.id,
      accountInstanceId,
      date,
      commentType,
    });

    return { response: {} };
  }
}
