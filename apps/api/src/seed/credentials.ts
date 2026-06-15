// Managed account password hashes (bcrypt — one-way, safe to commit).
// Plaintexts are NOT stored here; they were shown once at rotation time.
// To rotate again: regenerate hashes and replace this map; the seed force-applies
// them on boot. (POC/pilot credential management — no password-change UI yet.)
export const CREDENTIAL_HASHES: Record<string, string> = {
  'admin@ubi.ph': '$2a$10$t5VM4D8DGVFpOM3RvH7EQOcQ7T785y.lxSphwBHGlRUfUs9H6wzjm',
  'ceo@ubi.ph': '$2a$10$zuo0r9V/N82HW6rY1uoc9uU.HFowE6cAxvIzTPpuuSWlK6ttgr7vS',
  'vpo@ubi.ph': '$2a$10$FJwlt6zApU4cfEDoDbo3Aea/6W6RkTRSqcpRd7oCIokqm4ODxOIzq',
  'pm@ubi.ph': '$2a$10$qlcX7Cq2LGzJYHJFmzfW.u8C5bUiWfnbtLQaBJxNp6CUk.r6xxPU6',
  'pe@ubi.ph': '$2a$10$Omq5z9mXW31VeJAR8t.ivOF0sVUEhL2iaPPTpAzI4hyef2ph37D9e',
  'insights-agent@ubi.ph': '$2a$10$8UG3ac0oYVS901nBXjSWKuWrkzjywa2OIRQDVTGB/DeNqs1JbqJ7K',
  'head-engineering@ubi.ph': '$2a$10$pN1FD2bm.cnNE7q5AqG7lOQSKF8utPynKeESp7uzPRpDYFJ1EcWNm',
  'head-procurement@ubi.ph': '$2a$10$Adu4DeLjzsptZ9.CRA89qeIsrGVJDuraw3lRIr.msGsEbWYNHPZIK',
  'head-operations@ubi.ph': '$2a$10$0up7XgM0XqDjfLExgCALmeqCFONwpCGJPTY0CxQvRBOIxpXbxsdtq',
  'head-survey@ubi.ph': '$2a$10$IMocJU5Iz7ZgeIEuJtQonOHh0XM7Y0VLycKphbvjHfWQBY76HsGGq',
  'head-mqc@ubi.ph': '$2a$10$EFRKpD4.mh3oTZssWqJzGeNEhKbtCAcv4qsySL2V7h36RJly968qi',
  'head-audit@ubi.ph': '$2a$10$OK4k3lvEGf08PeCX89iKS.J37uC.LNhUpSFqA8YBHeBUyfofdJRTO',
  'head-it@ubi.ph': '$2a$10$LSq3metsAWXXUJ3Mf1tN1uDd0mNTtGiym1clQrs76e1DRkT0Dehqe',
  'head-records@ubi.ph': '$2a$10$dFzqxe0pe0p3aT5XKffVKOvUlAIpZXmqt01fhnj7hpfQJAtuhlPsW',
  'head-clinic@ubi.ph': '$2a$10$bOC1DMcNRu1YWS4eGyTUi.75UjevtQqfnHm8YTo7a4GPCmOWFZsZW',
  'head-admin@ubi.ph': '$2a$10$lLFfJsLBt8bVYUhHgddSXOWIEfGQPsYa2dSUuX6iiU78luXI.NtHa',
  'head-hr@ubi.ph': '$2a$10$v/lkzSKBuLcTZ7CuSOerNOSWlbF4xAi3Imm2NfKcZVcIYr91/Jsgy',
  'head-property@ubi.ph': '$2a$10$HMKqkW9Ci2pQgYo.jt.QlufCKatfzQ7mcl4CmgGADtnUdn.EBqMl2',
  'head-finance@ubi.ph': '$2a$10$EbdOy29IVWI5XY0NSk.nJOlQAxD0DMxFstxRm8k6yzd2oPsSfDZhq',
};
