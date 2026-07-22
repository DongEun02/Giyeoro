const RELATED_PRS_PER_ISSUE = 100;
const RELATED_PRS_BATCH_SIZE = 10;
const RECENT_COMMENTS_PER_ISSUE = 50;
const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const BOT_LOGIN_PATTERN = /\[bot\]$|^(dependabot|renovate|github-actions)$/i;
const CLAIM_INTENT_PATTERN = new RegExp([
  "(?:can|could|may)\\s+i\\s+(?:work\\s+on|take|pick\\s+up|handle|implement|fix)",
  "i(?:'d|\\s+would)\\s+(?:like|love)\\s+to\\s+(?:work\\s+on|take|pick\\s+up|handle|implement|fix|contribute\\s+to)",
  "i(?:'m|\\s+am)\\s+interested\\s+in\\s+(?:working\\s+on|taking|picking\\s+up|handling|implementing|fixing)",
  "i(?:'d|\\s+would|\\s+want\\s+to|\\s+will|'ll|\\s+am\\s+going\\s+to)?\\s+(?:work\\s+on|take|pick\\s+up|handle|implement|fix)\\s+(?:this|it|the\\s+issue)",
  "(?:please\\s+)?assign(?:\\s+this|\\s+it|\\s+the\\s+issue)?\\s+to\\s+me",
  "(?:please\\s+)?assign\\s+me",
  "(?:i(?:'m|\\s+am)\\s+)?(?:currently\\s+)?working\\s+on\\s+(?:this|it|the\\s+issue)",
  "(?:started|starting)\\s+(?:to\\s+work|working)\\s+on\\s+(?:this|it|the\\s+issue)",
  "happy\\s+to\\s+(?:work\\s+on|take|pick\\s+up|handle)\\s+(?:this|it|the\\s+issue)",
  "제가.{0,30}(?:맡|작업|수정|구현|기여).{0,20}(?:될까요|해도\\s*될까요|하고\\s*싶|하겠습니다)",
  "(?:저에게|저한테).{0,20}(?:할당|배정).{0,20}(?:해주세요|부탁)"
].join("|"), "i");

const ISSUE_AVAILABILITY_QUERY = `
  query IssueAvailability($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Issue {
        id
        timelineItems(first: ${RELATED_PRS_PER_ISSUE}, itemTypes: [CROSS_REFERENCED_EVENT]) {
          nodes {
            ... on CrossReferencedEvent {
              source {
                __typename
                ... on PullRequest {
                  id
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
        comments(last: ${RECENT_COMMENTS_PER_ISSUE}) {
          nodes {
            body
            authorAssociation
            author {
              login
            }
          }
          pageInfo {
            hasPreviousPage
          }
        }
      }
    }
  }
`;

const githubHeaders = (githubToken: any) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${githubToken}`,
  "Content-Type": "application/json",
  "User-Agent": "giyeoro-issue-availability",
  "X-GitHub-Api-Version": "2022-11-28"
});

const commentTextWithoutQuotesOrCode = (body: any) => String(body || "")
  .replace(/```[\s\S]*?```/g, " ")
  .split(/\r?\n/)
  .filter(line => !line.trim().startsWith(">"))
  .join(" ")
  .replace(/`[^`]*`/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const hasClaimIntent = (body: any) => CLAIM_INTENT_PATTERN.test(
  commentTextWithoutQuotesOrCode(body)
);

const isExternalClaimComment = (comment: any) => (
  !MAINTAINER_ASSOCIATIONS.has(comment?.authorAssociation || "")
  && !BOT_LOGIN_PATTERN.test(comment?.author?.login || "")
  && hasClaimIntent(comment?.body)
);

const issueAvailabilityResult = (node: any) => {
  const pullRequestIds = (node?.timelineItems?.nodes || [])
    .map((event: any) => event?.source)
    .filter((source: any) => source?.__typename === "PullRequest" && source.id)
    .map((pullRequest: any) => pullRequest.id);

  const claimCommentCount = (node?.comments?.nodes || []).filter(isExternalClaimComment).length;
  return {
    relatedPullRequestCount: new Set(pullRequestIds).size,
    relatedPullRequestCountTruncated: !!node?.timelineItems?.pageInfo?.hasNextPage,
    claimCommentCount,
    claimCommentReviewTruncated: !!node?.comments?.pageInfo?.hasPreviousPage
  };
};

type IssueAvailability = ReturnType<typeof issueAvailabilityResult>;

const fetchIssueAvailabilityBatch = async (
  nodeIds: string[],
  githubToken: any
): Promise<Array<readonly [string, IssueAvailability]>> => {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: githubHeaders(githubToken),
    body: JSON.stringify({
      query: ISSUE_AVAILABILITY_QUERY,
      variables: { ids: nodeIds }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  if (response.status === 403 || response.status === 429) throw new Error("GITHUB_RATE_LIMIT");
  if (!response.ok) throw new Error("GITHUB_ISSUE_AVAILABILITY_UNAVAILABLE");

  const payload: any = await response.json();
  if (payload.errors?.length) {
    const exceededResourceLimit = payload.errors.some(
      (error: any) => error?.type === "RESOURCE_LIMITS_EXCEEDED"
    );
    if (exceededResourceLimit && nodeIds.length > 1) {
      const middle = Math.ceil(nodeIds.length / 2);
      const leftResults = await fetchIssueAvailabilityBatch(nodeIds.slice(0, middle), githubToken);
      const rightResults = await fetchIssueAvailabilityBatch(nodeIds.slice(middle), githubToken);
      return [...leftResults, ...rightResults];
    }
    throw new Error("GITHUB_ISSUE_AVAILABILITY_UNAVAILABLE");
  }

  return (payload.data?.nodes || [])
    .filter((node: any) => node?.id)
    .map((node: any) => [node.id, issueAvailabilityResult(node)] as const);
};

export const enrichIssueAvailability = async (
  issues: any,
  githubToken: any,
  {
    required = false,
    stopAfterUnclaimed = Number.POSITIVE_INFINITY
  } = {}
) => {
  if (issues.length === 0) return issues;
  if (!githubToken) {
    if (required) throw new Error("GITHUB_TOKEN_REQUIRED");
    return issues;
  }

  const nodeIds = [...new Set<string>(
    issues
      .map((issue: any) => issue.githubNodeId)
      .filter((nodeId: any): nodeId is string => typeof nodeId === "string" && nodeId.length > 0)
  )];
  if (nodeIds.length === 0) {
    if (required) throw new Error("GITHUB_ISSUE_AVAILABILITY_UNAVAILABLE");
    return issues;
  }

  try {
    const availabilityByNodeId = new Map<string, IssueAvailability>();
    let stoppedEarly = false;

    for (let offset = 0; offset < nodeIds.length; offset += RELATED_PRS_BATCH_SIZE) {
      const batchNodeIds = nodeIds.slice(offset, offset + RELATED_PRS_BATCH_SIZE);
      const batchResults = await fetchIssueAvailabilityBatch(batchNodeIds, githubToken);
      batchResults.forEach(([nodeId, result]) => {
        availabilityByNodeId.set(nodeId, result);
      });

      if (required && batchNodeIds.some(nodeId => !availabilityByNodeId.has(nodeId))) {
        throw new Error("GITHUB_ISSUE_AVAILABILITY_UNAVAILABLE");
      }

      const unclaimedCount = issues.filter((issue: any) => {
        const availability = availabilityByNodeId.get(issue.githubNodeId);
        return (
          (issue.assignees?.length || 0) === 0
          && availability?.relatedPullRequestCount === 0
          && !availability.relatedPullRequestCountTruncated
          && availability.claimCommentCount === 0
          && !availability.claimCommentReviewTruncated
        );
      }).length;
      if (unclaimedCount >= stopAfterUnclaimed) {
        stoppedEarly = true;
        break;
      }
    }

    if (required && !stoppedEarly && nodeIds.some(nodeId => !availabilityByNodeId.has(nodeId))) {
      throw new Error("GITHUB_ISSUE_AVAILABILITY_UNAVAILABLE");
    }

    return issues.map((issue: any) => {
      const availability = availabilityByNodeId.get(issue.githubNodeId);
      if (!availability) return issue;
      return {
        ...issue,
        ...availability
      };
    });
  } catch (error) {
    if (required) throw error;
    return issues;
  }
};

export const isUnclaimedIssue = (issue: any) => (
  (issue.assignees?.length || 0) === 0
  && issue.relatedPullRequestCount === 0
  && !issue.relatedPullRequestCountTruncated
  && issue.claimCommentCount === 0
  && !issue.claimCommentReviewTruncated
);
