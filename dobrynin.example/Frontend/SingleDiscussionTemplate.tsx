import { TextArea } from '@components/Comment/CommentStyled';
import Button from '@components/Button';
import Loader from '@components/Loader';
import Comment from '@components/Comment';
import BackButton from '@components/BackButton';
import { ReactComponent as CloseIcon } from '@assets/cross.svg';
import { TypeOfComment } from '@components/Comment/CommentTypes';
import { checkThatYourCurrentDiscussionIsPickedCellDiscussion } from '@utils/dynamicCells';
import roundSimple from '@utils/roundSimple';
import UserAvatar from '@components/UserAvatar';
import { toJS } from 'mobx';
import { useStore } from '@MobX/RootStore';
import { observer } from 'mobx-react-lite';
import { Months, SystemComments } from './SingleDiscussionTypes';

import {
  ActionContainer,
  Footer,
  InputField,
  Comments,
  SidebarHeader,
  SidebarTitle,
  SidebarOptionsButtons,
  SidebarCloseButton,
} from '../Sidebar/SidebarStyled';

interface SingleDiscussionTemplateProps {
  discussionId;
  currentUser;
  mutateCloseDiscussion;
  thisComments;
  sendComment;
  refetchComments;
  isDiscussionActive;
  commentValue;
  setCommentValue;
  chatRef;
  isLoading;
  handleBackButtonClick;
  sendReopenComment;
  handleCloseSidebar;
}
export const SingleDiscussionTemplate: React.FC<SingleDiscussionTemplateProps> =
  observer(
    ({
      discussionId,
      currentUser,
      mutateCloseDiscussion,
      thisComments,
      sendComment,
      refetchComments,
      isDiscussionActive,
      commentValue,
      setCommentValue,
      chatRef,
      isLoading,
      handleBackButtonClick,
      sendReopenComment,
      handleCloseSidebar,
    }) => {
      const {
        NewBudgetStore: { getIsDiscussionActive },
      } = useStore();
      const enterAlias = 'Enter';
      const isHotKeyRight = (event) =>
        event.key === enterAlias && !event.shiftKey;
      const isCurrentComment = (comment) =>
        checkThatYourCurrentDiscussionIsPickedCellDiscussion(
          comment.expenseCell,
          discussionId,
        );

      const isCurrentCellHasOpenedDiscussions: boolean = getIsDiscussionActive({
        accountInstanceId: discussionId.accountInstanceId,
        year: +discussionId.date.split(':')[0],
        month: +discussionId.date.split(':')[1],
      });
      const CommentsList = () =>
        thisComments?.length
          ? thisComments?.map((comment) =>
            isCurrentComment(comment) && !comment.isTemplate ? (
              <Comment
                isPreview={false}
                key={comment?.id}
                comment={comment}
                refetchComments={refetchComments}
                commentType={comment.commentType}
                sendComment={sendComment}
                isHotKeyRight={isHotKeyRight}
              />
            ) : null,
          )
          : null;
      /* eslint-disable no-nested-ternary */
      return (
        <>
          <SidebarHeader>
            <BackButton onClick={handleBackButtonClick} />

            <SidebarTitle>
              {`${discussionId?.value ? roundSimple(discussionId?.value, 2) : ''
                }
            ${Months[discussionId?.date.split(':')[1]]}
            ${discussionId?.date.split(':')[0]}`}
            </SidebarTitle>

            <SidebarOptionsButtons>
              <SidebarCloseButton onClick={handleCloseSidebar}>
                <CloseIcon />
              </SidebarCloseButton>
            </SidebarOptionsButtons>
          </SidebarHeader>

          <Comments ref={chatRef}>
            {isLoading ? <Loader /> : <CommentsList />}
          </Comments>

          <Footer>
            <InputField>
              <UserAvatar size={24}>{currentUser}</UserAvatar>
              <TextArea
                margin="0px 0px 16px"
                placeholder={
                  isDiscussionActive
                    ? 'Add a comment'
                    : 'Add a comment, if you want to start the conversation'
                }
                value={commentValue}
                onChange={(e) => {
                  setCommentValue(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (isHotKeyRight(e)) {
                    e.preventDefault();
                    sendComment();
                  }
                }}
              />
            </InputField>
            <ActionContainer>
              {isCurrentCellHasOpenedDiscussions ? (
                <Button
                  theme="users"
                  width="140px"
                  margin="0 12px 0 0"
                  onClick={() => {
                    mutateCloseDiscussion(discussionId);
                    sendComment(
                      TypeOfComment.system,
                      SystemComments.MarkedAsSolved,
                    );
                  }}
                >
                  Mark as solved
                </Button>
              ) : null}
              <Button
                title={enterAlias}
                theme="main"
                width="100px"
                onClick={() => {
                  sendReopenComment();
                  if (commentValue.trim() !== '') sendComment();
                }}
              >
                Comment
              </Button>
            </ActionContainer>
          </Footer>
        </>
      );
    },
  );
