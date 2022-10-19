import { useEffect, useState, useRef } from 'react';
import { getCommentsInSpecificCell, closeDiscussion } from '@queries/comments';
import { useMutation } from 'react-query';
import { useAuth } from '@utils/AuthContext';
import useKeydown from '@hooks/useKeydown';
import { io } from 'socket.io-client';

import { TypeOfComment } from '@components/Comment/CommentTypes';
import { serverAddress } from '@queries/utils';
import {
  checkThatYourCurrentDiscussionIsPickedCellDiscussion,
  CellSimpleDatePattern,
} from '@utils/dynamicCells';
import { useStore } from '@MobX/RootStore';
import { observer } from 'mobx-react-lite';
import { SingleDiscussionTemplate } from './SingleDiscussionTemplate';
import { SystemComments } from './SingleDiscussionTypes';
import message from '../message';

interface SingleDiscussionBehaviorProps {
  currentDiscussion;
  setPickedCellForDiscussId;
  discussionId;
  setPreviewMode;
  isManagerView;
  setIsSidebarVisible;
}
export const SingleDiscussionBehavior: React.FC<SingleDiscussionBehaviorProps> =
  observer(
    ({
      currentDiscussion,
      setPickedCellForDiscussId,
      discussionId,
      setPreviewMode,
      isManagerView,
      setIsSidebarVisible,
    }) => {
      const [currentUser] = useAuth();
      const [isDiscussionActive, setIsDiscussionActive] = useState(null);
      const [thisComments, setThisComments] = useState([]);
      const [commentValue, setCommentValue] = useState<string>('');
      const socket = useRef<ReturnType<typeof io>>(null);
      const chatRef = useRef(null);
      const discussionStatus =
        currentDiscussion?.expenseCell.isDiscussionActive;

      const {
        NewBudgetStore: {
          addCellIdsWithOpenedDiscussions,
          removeCellIdsWithOpenedDiscussions,
        },
      } = useStore();

      function handleBackButtonClick() {
        setPreviewMode(true);
        setPickedCellForDiscussId(null);
      }

      function handleCloseSidebar() {
        setIsSidebarVisible(false);
        setPreviewMode(true);
        setPickedCellForDiscussId(null);
      }

      useKeydown('Escape', handleBackButtonClick);

      const {
        data: commentsData,
        refetch: refetchComments,
        isLoading,
        error,
      } = getCommentsInSpecificCell(discussionId);

      useEffect(() => {
        if (error && !discussionId.isTemplate)
          message.error(`Error: ${commentsData?.message}`);
      }, [error]);

      useEffect(() => {
        if (!isLoading) {
          if (!discussionId.isTemplate) {
            refetchComments();
          }
          setThisComments(commentsData?.response?.comments);
          setCommentValue('');
        }
      }, [isLoading, commentsData, discussionId]);

      useEffect(() => {
        socket.current = io(serverAddress, {
          withCredentials: true,
        });
        socket.current.on('commentToClient', (msg) => {
          if (
            checkThatYourCurrentDiscussionIsPickedCellDiscussion(
              msg?.comment?.expenseCell,
              discussionId,
            )
          ) {
            setThisComments((prev) => {
              const editedCommentIndex = prev?.findIndex(
                (prevComment) => prevComment.id === msg?.comment?.id,
              );
              if (editedCommentIndex >= 0) {
                const newComments = [...prev];
                newComments[editedCommentIndex].value = msg?.comment?.value;
                newComments[editedCommentIndex].updatedAt =
                  msg?.comment?.updatedAt;
                return newComments;
              }
              return prev?.length ? [...prev, msg.comment] : [msg.comment];
            });
            if (msg.comment.commentType === 'custom') {
              addCellIdsWithOpenedDiscussions(msg.comment.expenseCell);
            }
          }
        });
        return () => {
          socket.current.disconnect();
        };
      }, [discussionId, commentsData]);

      function scrollChat() {
        const chat = chatRef.current;
        chat.scrollTo(0, chat.scrollHeight);
      }

      useEffect(() => {
        if (
          checkThatYourCurrentDiscussionIsPickedCellDiscussion(
            currentDiscussion?.expenseCell,
            discussionId,
          )
        ) {
          setIsDiscussionActive(discussionStatus);
        }

        scrollChat();
      }, [thisComments, discussionStatus]);

      const { mutate: mutateCloseDiscussion } = useMutation(closeDiscussion, {
        onSuccess: () =>
          removeCellIdsWithOpenedDiscussions({
            accountInstanceId: discussionId.accountInstanceId,
            year: +discussionId.date.split(':')[0],
            month: +discussionId.date.split(':')[1],
          }),
      });

      function sendComment(
        commentType: TypeOfComment = TypeOfComment.custom,
        value: string = commentValue,
        commentId?: number,
      ) {
        const newMessage: {
          value: string;
          userId: number;
          date: CellSimpleDatePattern;
          accountInstanceId: number;
          commentType: TypeOfComment;
          id?: number;
        } = {
          value,
          userId: currentUser.id,
          date: discussionId.date,
          accountInstanceId: discussionId.accountInstanceId,
          commentType,
          id: commentId,
        };
        socket.current.emit('commentToServer', newMessage);
        setCommentValue('');
      }

      const lastComment = thisComments?.[thisComments.length - 1];
      const sendReopenComment = () => {
        if (
          lastComment?.commentType === TypeOfComment.system &&
          lastComment?.value === SystemComments.MarkedAsSolved
        ) {
          sendComment(TypeOfComment.system, SystemComments.Reopen);
        }
      };

      return (
        <SingleDiscussionTemplate
          discussionId={discussionId}
          currentUser={currentUser}
          mutateCloseDiscussion={mutateCloseDiscussion}
          thisComments={thisComments}
          sendComment={sendComment}
          refetchComments={refetchComments}
          isDiscussionActive={isDiscussionActive}
          commentValue={commentValue}
          setCommentValue={setCommentValue}
          chatRef={chatRef}
          isLoading={isLoading}
          handleBackButtonClick={handleBackButtonClick}
          sendReopenComment={sendReopenComment}
          handleCloseSidebar={handleCloseSidebar}
        />
      );
    },
  );
