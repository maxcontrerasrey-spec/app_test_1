---
document_id: EEES-AUDIT-CONSISTENCY
title: EEES Consistency Audit
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# EEES Consistency Audit

## Estado

FAIL

## Resumen

- Errores: 3
- Warnings: 1
- Info: 16

## Errores

- EEES-GATE · `audit:repository-cleanup` · > app_test_1@0.1.0 audit:repository-cleanup
> node scripts/audit-repository-cleanup.mjs


Repository cleanup audit failed:
- node_modules/.bin 2 parece una copia conflictiva local
- node_modules/.vite 2 parece una copia conflictiva local
- node_modules/@babel 2 parece una copia conflictiva local
- node_modules/@bcoe 2 parece una copia conflictiva local
- node_modules/@esbuild 2 parece una copia conflictiva local
- node_modules/@fontsource 2 parece una copia conflictiva local
- node_modules/@jridgewell 2 parece una copia conflictiva local
- node_modules/@mylinkpi 2 parece una copia conflictiva local
- node_modules/@rolldown 2 parece una copia conflictiva local
- node_modules/@rollup 2 parece una copia conflictiva local
- node_modules/@standard-schema 2 parece una copia conflictiva local
- node_modules/@supabase 2 parece una copia conflictiva local
- node_modules/@tanstack 2 parece una copia conflictiva local
- node_modules/@types 2 parece una copia conflictiva local
- node_modules/@ungap 2 parece una copia conflictiva local
- node_modules/@vitejs 2 parece una copia conflictiva local
- node_modules/@vitest 2 parece una copia conflictiva local
- node_modules/assertion-error 2 parece una copia conflictiva local
- node_modules/ast-v8-to-istanbul 2 parece una copia conflictiva local
- node_modules/bail 2 parece una copia conflictiva local
- node_modules/baseline-browser-mapping 2 parece una copia conflictiva local
- node_modules/browserslist 2 parece una copia conflictiva local
- node_modules/caniuse-lite 2 parece una copia conflictiva local
- node_modules/ccount 2 parece una copia conflictiva local
- node_modules/chai 2 parece una copia conflictiva local
- node_modules/character-entities 2 parece una copia conflictiva local
- node_modules/character-entities-html4 2 parece una copia conflictiva local
- node_modules/comma-separated-tokens 2 parece una copia conflictiva local
- node_modules/convert-source-map 2 parece una copia conflictiva local
- node_modules/cookie-es 2 parece una copia conflictiva local
- node_modules/debug 2 parece una copia conflictiva local
- node_modules/dequal 2 parece una copia conflictiva local
- node_modules/devlop 2 parece una copia conflictiva local
- node_modules/echarts 2 parece una copia conflictiva local
- node_modules/echarts-for-react 2 parece una copia conflictiva local
- node_modules/es-module-lexer 2 parece una copia conflictiva local
- node_modules/esbuild 2 parece una copia conflictiva local
- node_modules/escalade 2 parece una copia conflictiva local
- node_modules/estree-util-is-identifier-name 2 parece una copia conflictiva local
- node_modules/estree-walker 2 parece una copia conflictiva local
- node_modules/expect-type 2 parece una copia conflictiva local
- node_modules/extend 2 parece una copia conflictiva local
- node_modules/fast-deep-equal 2 parece una copia conflictiva local
- node_modules/fdir 2 parece una copia conflictiva local
- node_modules/gensync 2 parece una copia conflictiva local
- node_modules/has-flag 2 parece una copia conflictiva local
- node_modules/hast-util-to-jsx-runtime 2 parece una copia conflictiva local
- node_modules/hast-util-whitespace 2 parece una copia conflictiva local
- node_modules/html-escaper 2 parece una copia conflictiva local
- node_modules/html-url-attributes 2 parece una copia conflictiva local
- node_modules/iceberg-js 2 parece una copia conflictiva local
- node_modules/inline-style-parser 2 parece una copia conflictiva local
- node_modules/is-alphanumerical 2 parece una copia conflictiva local
- node_modules/istanbul-lib-coverage 2 parece una copia conflictiva local
- node_modules/istanbul-lib-report 2 parece una copia conflictiva local
- node_modules/istanbul-reports 2 parece una copia conflictiva local
- node_modules/jsesc 2 parece una copia conflictiva local
- node_modules/json5 2 parece una copia conflictiva local
- node_modules/lru-cache 2 parece una copia conflictiva local
- node_modules/magic-string 2 parece una copia conflictiva local
- node_modules/magicast 2 parece una copia conflictiva local
- node_modules/make-dir 2 parece una copia conflictiva local
- node_modules/mdast-util-find-and-replace 2 parece una copia conflictiva local
- node_modules/mdast-util-from-markdown 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm-autolink-literal 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm-footnote 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm-strikethrough 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm-table 2 parece una copia conflictiva local
- node_modules/mdast-util-gfm-task-list-item 2 parece una copia conflictiva local
- node_modules/mdast-util-mdx-expression 2 parece una copia conflictiva local
- node_modules/mdast-util-mdx-jsx 2 parece una copia conflictiva local
- node_modules/mdast-util-mdxjs-esm 2 parece una copia conflictiva local
- node_modules/mdast-util-phrasing 2 parece una copia conflictiva local
- node_modules/mdast-util-to-hast 2 parece una copia conflictiva local
- node_modules/mdast-util-to-markdown 2 parece una copia conflictiva local
- node_modules/mdast-util-to-string 2 parece una copia conflictiva local
- node_modules/micromark 2 parece una copia conflictiva local
- node_modules/micromark-core-commonmark 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-autolink-literal 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-footnote 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-strikethrough 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-table 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-tagfilter 2 parece una copia conflictiva local
- node_modules/micromark-extension-gfm-task-list-item 2 parece una copia conflictiva local
- node_modules/micromark-factory-destination 2 parece una copia conflictiva local
- node_modules/micromark-factory-label 2 parece una copia conflictiva local
- node_modules/micromark-factory-space 2 parece una copia conflictiva local
- node_modules/micromark-factory-title 2 parece una copia conflictiva local
- node_modules/micromark-factory-whitespace 2 parece una copia conflictiva local
- node_modules/micromark-util-character 2 parece una copia conflictiva local
- node_modules/micromark-util-chunked 2 parece una copia conflictiva local
- node_modules/micromark-util-classify-character 2 parece una copia conflictiva local
- node_modules/micromark-util-decode-numeric-character-reference 2 parece una copia conflictiva local
- node_modules/micromark-util-decode-string 2 parece una copia conflictiva local
- node_modules/micromark-util-normalize-identifier 2 parece una copia conflictiva local
- node_modules/micromark-util-sanitize-uri 2 parece una copia conflictiva local
- node_modules/micromark-util-subtokenize 2 parece una copia conflictiva local
- node_modules/micromark-util-symbol 2 parece una copia conflictiva local
- node_modules/micromark-util-types 2 parece una copia conflictiva local
- node_modules/nanoid 2 parece una copia conflictiva local
- node_modules/node-releases 2 parece una copia conflictiva local
- node_modules/obug 2 parece una copia conflictiva local
- node_modules/parse-entities 2 parece una copia conflictiva local
- node_modules/pathe 2 parece una copia conflictiva local
- node_modules/picocolors 2 parece una copia conflictiva local
- node_modules/picomatch 2 parece una copia conflictiva local
- node_modules/playwright 2 parece una copia conflictiva local
- node_modules/playwright-core 2 parece una copia conflictiva local
- node_modules/postcss 2 parece una copia conflictiva local
- node_modules/property-information 2 parece una copia conflictiva local
- node_modules/react 2 parece una copia conflictiva local
- node_modules/react-dom 2 parece una copia conflictiva local
- node_modules/react-markdown 2 parece una copia conflictiva local
- node_modules/react-refresh 2 parece una copia conflictiva local
- node_modules/react-router 2 parece una copia conflictiva local
- node_modules/remark-gfm 2 parece una copia conflictiva local
- node_modules/remark-parse 2 parece una copia conflictiva local
- node_modules/remark-rehype 2 parece una copia conflictiva local
- node_modules/remark-stringify 2 parece una copia conflictiva local
- node_modules/rollup 2 parece una copia conflictiva local
- node_modules/scheduler 2 parece una copia conflictiva local
- node_modules/semver 2 parece una copia conflictiva local
- node_modules/siginfo 2 parece una copia conflictiva local
- node_modules/size-sensor 2 parece una copia conflictiva local
- node_modules/source-map-js 2 parece una copia conflictiva local
- node_modules/space-separated-tokens 2 parece una copia conflictiva local
- node_modules/stackback 2 parece una copia conflictiva local
- node_modules/std-env 2 parece una copia conflictiva local
- node_modules/stringify-entities 2 parece una copia conflictiva local
- node_modules/style-to-js 2 parece una copia conflictiva local
- node_modules/style-to-object 2 parece una copia conflictiva local
- node_modules/supports-color 2 parece una copia conflictiva local
- node_modules/tinybench 2 parece una copia conflictiva local
- node_modules/tinyexec 2 parece una copia conflictiva local
- node_modules/tinyglobby 2 parece una copia conflictiva local
- node_modules/tinyrainbow 2 parece una copia conflictiva local
- node_modules/trim-lines 2 parece una copia conflictiva local
- node_modules/trough 2 parece una copia conflictiva local
- node_modules/tslib 2 parece una copia conflictiva local
- node_modules/typescript 2 parece una copia conflictiva local
- node_modules/unified 2 parece una copia conflictiva local
- node_modules/unist-util-is 2 parece una copia conflictiva local
- node_modules/unist-util-position 2 parece una copia conflictiva local
- node_modules/unist-util-stringify-position 2 parece una copia conflictiva local
- node_modules/unist-util-visit 2 parece una copia conflictiva local
- node_modules/unist-util-visit-parents 2 parece una copia conflictiva local
- node_modules/update-browserslist-db 2 parece una copia conflictiva local
- node_modules/vfile 2 parece una copia conflictiva local
- node_modules/vfile-message 2 parece una copia conflictiva local
- node_modules/vite 2 parece una copia conflictiva local
- node_modules/vitest 2 parece una copia conflictiva local
- node_modules/why-is-node-running 2 parece una copia conflictiva local
- node_modules/yallist 2 parece una copia conflictiva local
- node_modules/zrender 2 parece una copia conflictiva local
- node_modules/zwitch 2 parece una copia conflictiva local
- node_modules/@supabase/supabase-js 2 parece una copia conflictiva local
- .git/index 2 parece una copia conflictiva local
- 0 copias numericas locales en node_modules/.git/info
- EEES-GATE · `test:integrity` · > app_test_1@0.1.0 test:integrity
> node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/integrity


 RUN  v4.1.10 /Users/maximilianocontrerasrey/Documents/GitHub/app_test_1

 ❯ tests/integrity/recruitment-sin-folio-detail.test.ts (2 tests | 1 failed) 8ms
     × passes the selected candidate through the detail query and cache key 6ms

 Test Files  1 failed | 8 passed (9)
      Tests  1 failed | 78 passed (79)
   Start at  12:34:44
   Duration  442ms (transform 287ms, setup 0ms, import 408ms, tests 48ms, environment 1ms)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integrity/recruitment-sin-folio-detail.test.ts > Sin Folio candidate detail contract > passes the selected candidate through the detail query and cache key
AssertionError: expected 'import { useEffect } from "react";\ni…' to contain 'candidateId ?? "case"'

- Expected
+ Received

- candidateId ?? "case"
+ import { useEffect } from "react";
+ import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
+ import { queryKeys } from "../../../shared/lib/queryKeys";
+ import {
+   fetchRecruitmentActiveCaseOptions,
+   fetchRecruitmentCaseDetail,
+   fetchRecruitmentCandidatesPage,
+   fetchRecruitmentContractedPersonnelPage,
+   fetchRecruitmentControlSummary,
+   fetchRecruitmentPendingApprovalsPage,
+   fetchRecruitmentPersonnelToHirePage,
+   fetchRecruitmentProcessesPage,
+   type RecruitmentCandidateStage
+ } from "../services/hiringControl";
+ import {
+   fetchDsalPrecandidatesPage,
+   type DsalPrecandidateStatus
+ } from "../services/precandidates";
+ import {
+   fetchHiringCatalogs,
+   syncBukJobPositionsBestEffort
+ } from "../services/hiringCatalogs";
+
+ const RECRUITMENT_DASHBOARD_STALE_TIME_MS = 20_000;
+ const RECRUITMENT_CASE_DETAIL_STALE_TIME_MS = 60_000;
+ const RECRUITMENT_CATALOGS_STALE_TIME_MS = 30 * 60_000;
+ const RECRUITMENT_CACHE_GC_TIME_MS = 15 * 60_000;
+ const RECRUITMENT_CATALOGS_GC_TIME_MS = 2 * 60 * 60_000;
+ const BUK_JOB_POSITION_REFRESH_INTERVAL_MS = 10 * 60_000;
+ let lastBukJobPositionRefreshAt = 0;
+
+ export type RecruitmentProcessesPageFilters = {
+   search?: string;
+   statusFilter?: string | null;
+   sortColumn?: string | null;
+   sortDirection?: "asc" | "desc";
+   limit: number;
+   offset: number;
+ };
+
+ export type RecruitmentCandidatesPageFilters = {
+   search?: string;
+   stageFilter?: RecruitmentCandidateStage | "active" | "discarded" | "without_folio";
+   limit: number;
+   offset: number;
+ };
+
+ export type RecruitmentPrecandidatesPageFilters = {
+   search?: string;
+   status?: DsalPrecandidateStatus | "all";
+   limit: number;
+   offset: number;
+ };
+
+ export type RecruitmentPersonnelPageFilters = {
+   search?: string;
+   limit: number;
+   offset: number;
+ };
+
+ export type RecruitmentApprovalsPageFilters = {
+   limit: number;
+   offset: number;
+ };
+
+ export function getRecruitmentControlSummaryQueryOptions() {
+   return {
+     queryKey: queryKeys.recruitment.controlSummary(),
+     queryFn: async () => {
+       const result = await fetchRecruitmentControlSummary();
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar el resumen.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     refetchInterval: 5 * 60_000,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false
+   };
+ }
+
+ export function getRecruitmentCaseDetailQueryOptions(caseId: string, candidateId?: string) {
+   return {
+     queryKey: queryKeys.recruitment.caseDetail(caseId, candidateId),
+     queryFn: async () => {
+       const result = await fetchRecruitmentCaseDetail(caseId, candidateId);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar el detalle del caso.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_CASE_DETAIL_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS
+   };
+ }
+
+ export function getHiringCatalogsQueryOptions() {
+   return {
+     queryKey: queryKeys.recruitment.hiringCatalogs(),
+     queryFn: async () => {
+       const result = await fetchHiringCatalogs();
+
+       if (result.error) {
+         throw new Error(result.error);
+       }
+
+       return result;
+     },
+     staleTime: RECRUITMENT_CATALOGS_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CATALOGS_GC_TIME_MS,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false
+   };
+ }
+
+ export function useRecruitmentControlSummary() {
+   return useQuery(getRecruitmentControlSummaryQueryOptions());
+ }
+
+ export function useRecruitmentPendingApprovalsPage(
+   filters: RecruitmentApprovalsPageFilters,
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.approvals(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentPendingApprovalsPage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar aprobaciones pendientes.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     enabled
+   });
+ }
+
+ export function useRecruitmentProcessesPage(filters: RecruitmentProcessesPageFilters) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.processes(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentProcessesPage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar procesos de contratación.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     placeholderData: (previous) => previous,
+     refetchInterval: 5 * 60_000,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false
+   });
+ }
+
+ export function useRecruitmentCandidatesPage(
+   filters: RecruitmentCandidatesPageFilters,
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.candidates(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentCandidatesPage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar candidatos.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     refetchInterval: enabled ? 5 * 60_000 : false,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false,
+     enabled
+   });
+ }
+
+ export function useRecruitmentPrecandidatesPage(
+   filters: RecruitmentPrecandidatesPageFilters,
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.precandidates(filters),
+     queryFn: async () => {
+       const result = await fetchDsalPrecandidatesPage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar precandidatos.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     refetchInterval: enabled ? 5 * 60_000 : false,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false,
+     enabled
+   });
+ }
+
+ export function useRecruitmentPersonnelToHirePage(
+   filters: RecruitmentPersonnelPageFilters,
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.personnel(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentPersonnelToHirePage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar personal a contratar.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     refetchInterval: enabled ? 5 * 60_000 : false,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false,
+     enabled
+   });
+ }
+
+ export function useRecruitmentContractedPersonnelPage(
+   filters: RecruitmentPersonnelPageFilters,
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.contractedPersonnel(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentContractedPersonnelPage(filters);
+
+       if (result.error || !result.data) {
+         throw new Error(result.error ?? "No fue posible cargar el personal contratado.");
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_DASHBOARD_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     refetchInterval: enabled ? 5 * 60_000 : false,
+     refetchOnWindowFocus: false,
+     refetchOnReconnect: false,
+     enabled
+   });
+ }
+
+ export function useRecruitmentActiveCaseOptions(
+   filters: { search?: string; limit?: number } = {},
+   enabled = true
+ ) {
+   return useQuery({
+     queryKey: queryKeys.recruitment.activeCaseOptions(filters),
+     queryFn: async () => {
+       const result = await fetchRecruitmentActiveCaseOptions(filters);
+
+       if (result.error) {
+         throw new Error(result.error);
+       }
+
+       return result.data;
+     },
+     staleTime: RECRUITMENT_CASE_DETAIL_STALE_TIME_MS,
+     gcTime: RECRUITMENT_CACHE_GC_TIME_MS,
+     enabled
+   });
+ }
+
+ export function useRecruitmentCaseDetail(
+   caseId: string,
+   enabled = true,
+   candidateId?: string
+ ) {
+   return useQuery({
+     ...getRecruitmentCaseDetailQueryOptions(caseId, candidateId),
+     enabled: enabled && Boolean(caseId)
+   });
+ }
+
+ export function useHiringCatalogs() {
+   const queryClient = useQueryClient();
+   const query = useQuery(getHiringCatalogsQueryOptions());
+
+   useEffect(() => {
+     if (!query.data || Date.now() - lastBukJobPositionRefreshAt < BUK_JOB_POSITION_REFRESH_INTERVAL_MS) {
+       return;
+     }
+
+     lastBukJobPositionRefreshAt = Date.now();
+     let isMounted = true;
+
+     void syncBukJobPositionsBestEffort().then((didSync) => {
+       if (didSync && isMounted) {
+         void queryClient.invalidateQueries({
+           queryKey: queryKeys.recruitment.hiringCatalogs()
+         });
+       }
+     });
+
+     return () => {
+       isMounted = false;
+     };
+   }, [query.data, query.dataUpdatedAt, queryClient]);
+
+   return query;
+ }
+
+ export async function invalidateRecruitmentControlQueries(
+   queryClient: QueryClient,
+   caseId?: string
+ ) {
+   await Promise.all([
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.controlSummary() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.approvalsRoot() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.processesRoot() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidatesRoot() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.precandidatesRoot() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.personnelRoot() }),
+     queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.contractedPersonnelRoot() }),
+     queryClient.invalidateQueries({
+       predicate: (query) => query.queryKey[0] === "recruitment" && query.queryKey[1] === "active-case-options"
+     })
+   ]);
+
+   if (caseId) {
+     await queryClient.invalidateQueries({
+       queryKey: queryKeys.recruitment.caseDetail(caseId)
+     });
+   }
+ }
+

 ❯ tests/integrity/recruitment-sin-folio-detail.test.ts:28:21
     26|     expect(service).toContain('supabase.rpc("get_recruitment_case_deta…
     27|     expect(queries).toContain("candidateId?: string");
     28|     expect(queries).toContain("candidateId ?? \"case\"");
       |                     ^
     29|     expect(page).toContain("selectedCandidateId || undefined");
     30|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
- EEES-GATE · `audit:performance-baseline` · > app_test_1@0.1.0 audit:performance-baseline
> node scripts/audit-performance-baseline.mjs


Performance baseline audit failed:
- dist total 10273363 <= baseline 10268353
- JS total 2754433 <= baseline 2750455
- CSS total 244157 <= baseline 243167

## Warnings

- PERF-001 · `src/modules/recruitment/components/CandidateDetailSidebar.tsx` · Archivo sobre 800 lineas: 813.

## Gates informativos

- test:unit: PASS
- test:contracts: PASS
- audit:enterprise-docs: PASS
- audit:p4-operational-readiness: PASS
- audit:enterprise-100-readiness: PASS
- audit:core-data-integrity: PASS
- test:concurrency: PASS
- test:idempotency: PASS
- audit:route-role-smoke: PASS
- audit:frontend-auth-smoke-matrix: PASS
- audit:onboarding-legacy-guards: PASS
- audit:migrations: PASS
- audit:supabase-security: PASS
- audit:competency-catalog-guards: PASS
- build:frontend-check: PASS
- git diff --check: PASS
