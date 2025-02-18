import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.border} 25%,
    ${({ theme }) => theme.colors.borderLight} 37%,
    ${({ theme }) => theme.colors.border} 63%
  );
  background-size: 1000px 100%;
  animation: ${shimmer} 2s infinite linear;
  border-radius: 4px;
`;

export const TaskSkeleton = styled(SkeletonBase)`
  height: 80px;
  margin-bottom: 8px;
`;

export const MetricSkeleton = styled(SkeletonBase)`
  height: 100px;
`;

export const DetailsSkeleton = styled(SkeletonBase)`
  height: 200px;
`; 