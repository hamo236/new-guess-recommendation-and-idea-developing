# NEON GUESS — تقرير التحقيق في اختفاء شاشة اللعب بعد Start Game

**التاريخ:** 2026-08-26  
**النطاق:** Recommendation and Idea Developing فقط، مع Firebase Test project `neon-guess-test` فقط  
**نوع العمل:** بحث وتحقيق تقني وتحليل أدلة؛ لا يتضمن هذا التقرير تعديلًا للكود أو نشر Rules  
**المكونات المشمولة:** 1v1، 2v2، Four، RTDB Rules، React state، navigation، listeners، recovery، private targets

## 1. الملخص التنفيذي

تم التحقيق في العرض الذي يظهر فيه شكل شاشة اللعب أو الشخصيات للحظة قصيرة بعد الضغط على **Start Game** ثم يختفي. النتيجة ليست تخمينًا عامًا: تم عزل سبب مؤكد لمسار 1v1 في بيئة Rules Emulator، مع تفسير كامل لسلوك الواجهة.

السبب الجذري لمسار 1v1 هو **عدم تطابق بين كتابة Start الفعلية في الموقع وبين قواعد RTDB الحالية**. الموقع ينفذ `syncEnterPreview()` كعملية `update()` متعددة المسارات، وتكتب العملية الحقلين:

- `rooms/<code>/transitionStartedAt`
- `rooms/<code>/transitionEndsAt`

لكن Rules الحالية لا تحتوي على صلاحية child-level لهذين الحقلين. صلاحية `rooms/$roomCode/.write` الحالية تسمح بإنشاء غرفة جديدة فقط عندما `!data.exists()`؛ وعند بدء لعبة في غرفة موجودة يصبح هذا الشرط false، فلا تمنح صلاحية للـfan-out. وبما أن التحديث متعدد المواقع يجب أن يكون مصرحًا لكل مسار متأثر، تفشل العملية كاملة بـ`PERMISSION_DENIED`.

بعد ذلك يحدث التسلسل المرئي التالي:

1. `GameStateContext.startGame()` يحسب الحالة المحلية الجديدة.
2. يرسل `START_GAME` إلى reducer قبل تأكيد Firebase.
3. ينتقل المستخدم إلى GameBoard/Preview أو يرى واجهة اللعب للحظة.
4. `syncEnterPreview()` يرسل Firebase `update()`.
5. Rules ترفض العملية بسبب transition timestamp children غير المصرح بها.
6. تبقى Firebase في حالة lobby.
7. listener يقرأ snapshot authoritative القديم ويرسل `FB_ROOM_SYNC`.
8. reducer يعيد `phase` إلى `lobby`.
9. `GameBoardPage` و`SessionRouteRestore` يوجهان المستخدم إلى `/one-v-one`.

إذًا اختفاء الشاشة ليس اختفاءً عشوائيًا ولا دليلًا على فشل تحميل الصور؛ إنه **optimistic local Start ثم authoritative lobby rollback بعد فشل Firebase authorization**.

## 2. تصنيف الأدلة

| الدليل | النوع | النتيجة |
|---|---|---|
| `src/firebase/gameSync.js:33-47` | SOURCE | يثبت أن `syncEnterPreview()` يكتب phase/status والـtimestamps عبر root `update()` واحد. |
| `database.rules.json:135-136` | SOURCE/RULES | يثبت أن صلاحية parent write للغرفة الموجودة لا تمنح صلاحية Start؛ شرط الإنشاء يتطلب `!data.exists()`. |
| `database.rules.json:178-180` | SOURCE/RULES | يثبت أن `phase` فقط له child write صريح للـhost. |
| `database.rules.json:201-217` | SOURCE/RULES | يثبت وجود child write صريح لـstatus وtimerEndTimestamp، لكن ليس transitionStartedAt أو transitionEndsAt أو revealEndTimestamp. |
| `database.rules.json:222-228` | SOURCE/RULES | يثبت أن roundResult/roundResults لهما قواعد مختلفة ولا يغطيان transition timestamps. |
| `/tmp/neon-guess-start-rules-probe.mjs` | EMULATOR PROBE | اختبر fan-out الفعلي ووجد رفض root update، ورفض timestamp children كل على حدة، ونجاح fan-out بعد حذف هذين الحقلين. |
| Emulator stdout 2026-08-26 13:42:07 | EMULATOR OUTPUT | سجّل `update at / failed: permission_denied` ثم `set at /rooms/probe-start/transitionStartedAt failed` و`transitionEndsAt failed`. |
| `GameStateContext.jsx:709-719` | SOURCE | يثبت أن `START_GAME` المحلي يحدث قبل انتظار `syncEnterPreview()`. |
| `GameStateContext.jsx:357-372` | SOURCE | يثبت أن snapshot Firebase يُرسل فورًا إلى `FB_ROOM_SYNC` بعد وصوله. |
| `GameStateContext.jsx:178-235` | SOURCE | يثبت أن reducer يأخذ `fb.phase` ويستبدل الحالة المحلية به. |
| `GameBoardPage.jsx:107-112` | SOURCE | يثبت أن `phase === LOBBY` ينفذ navigation إلى `/one-v-one`. |
| `SessionRouteRestore.jsx` | SOURCE | يضيف route restoration مستقلًا يعيد lobby عند phase lobby. |

## 3. التتبع الكامل من الزر إلى الخطأ

### 3.1 واجهة Lobby

في `LobbyPage.jsx` يتم تشغيل Start من واجهة المضيف بعد اكتمال شرط عدد اللاعبين. واجهة Lobby لا تُظهر في هذا المسار أن Firebase أكد الانتقال قبل استدعاء action؛ لذلك لا تمنع وحدها الحالة المحلية الانتقال المؤقت.

### 3.2 GameStateContext

في `GameStateContext.jsx:709-720`:

```js
const nextState = engineEnterPreview(state);
dispatch({ type: A.START_GAME });

if (isFirebaseConfigured && state.roomCode) {
  await syncEnterPreview(state.roomCode, nextState);
}
```

هذا الترتيب يفسر الوميض مباشرة: reducer يغير الحالة المحلية قبل أن تنجح الكتابة الموثوقة. هذا ليس بالضرورة خطأ تصميميًا في حد ذاته، لكنه يحتاج عقدًا واضحًا مع Rules أو rollback مقصودًا عند الفشل.

### 3.3 Firebase fan-out

في `gameSync.js:33-47`، يتم إنشاء object واحد ثم استدعاء:

```js
await update(ref(db), updates);
```

الحقول المكتوبة في Start Preview هي:

| المسار | القيمة |
|---|---|
| `rooms/<code>/phase` | `preview` |
| `rooms/<code>/status` | `preview` |
| `rooms/<code>/round` | رقم الجولة |
| `rooms/<code>/roundResult` | `null` |
| `rooms/<code>/bracket` | bracket أو null |
| `rooms/<code>/playerAssignments` | map |
| `rooms/<code>/matchResults` | map |
| `rooms/<code>/standings` | array |
| `rooms/<code>/revealEndTimestamp` | 0 |
| `rooms/<code>/transitionStartedAt` | timestamp أو 0 |
| `rooms/<code>/transitionEndsAt` | timestamp أو 0 |
| `rooms/<code>/timerEndTimestamp` | 0 |

### 3.4 Rules mismatch

القواعد الحالية تحتوي على صلاحيات Host منفصلة لبعض الحقول:

- `phase` موجود عند السطر 178-180.
- `status` موجود عند 201-203.
- `round` موجود عند 189-191.
- `timerEndTimestamp` موجود عند 216-218.
- `roundResult` موجود عند 222-224.
- `bracket`, `playerAssignments`, `matchResults`, `standings` لها صلاحيات منفصلة.

لكن لا يوجد child rule مماثل لـ:

- `transitionStartedAt`
- `transitionEndsAt`
- `revealEndTimestamp`

والـparent `.write` عند `rooms/$roomCode` لا يصلح كبديل؛ فهو مشروط بإنشاء غرفة جديدة فقط. هذه هي نقطة الرفض المؤكدة في الـemulator.

## 4. الدليل التجريبي المباشر

تم تشغيل probe مؤقت خارج المستودع ضد Local Realtime Database Rules Emulator، بدون كتابة إلى Firebase الحي وبدون تعديل durable في المشروع.

النتائج المسجلة:

```text
@firebase/database: update at / failed: permission_denied
@firebase/database: set at /rooms/probe-start/transitionStartedAt failed: permission_denied
@firebase/database: set at /rooms/probe-start/transitionEndsAt failed: permission_denied
@firebase/database: update at / failed: permission_denied
```

الـprobe اختبر ثلاث حالات:

1. fan-out Start الكامل: **DENIED**.
2. كتابة `transitionStartedAt` منفردة: **DENIED**.
3. كتابة `transitionEndsAt` منفردة: **DENIED**.
4. fan-out بعد حذف timestamp children: **ALLOWED** في الـprobe.

هذا يثبت أن الرفض ليس بسبب الصورة أو route أو اتصال الهاتف، بل بسبب authorization contract غير مكتمل لمسار Start Preview.

## 5. لماذا يظهر الشكل ثم يختفي؟

`FB_ROOM_SYNC` في `GameStateContext.jsx:178-235` ينسخ `fb.phase` إلى الحالة authoritative. إذا بقيت Firebase في `lobby` لأن `syncEnterPreview` فشلت، فالحالة المحلية التي كانت `preview` تُستبدل بـ`lobby` عند snapshot التالي.

ثم في `GameBoardPage.jsx:107-112`:

```js
if (phase === GAME_PHASES.LOBBY) {
  navigate(mode === GAME_MODES.ONE_V_ONE ? '/one-v-one' : '/');
}
```

لذلك اختفاء شاشة اللعبة خلال أقل من ثانية متوافق زمنيًا مع:

```text
local START_GAME → visible preview → Firebase denial → lobby snapshot → redirect
```

هذا يفسر العرض بدقة أكثر من فرضية فشل تحميل assets؛ لو كان asset failure فقط لبقيت route والحالة، بينما الأدلة المصدرية تثبت وجود redirect عند lobby.

## 6. هل Rules المنشورة هي السبب الوحيد؟

بالنسبة لمسار 1v1 Start Preview، يوجد دليل قوي ومباشر أن Rules الحالية وحدها كافية لإفشال العملية. لكن توجد نقطة ثانية في الموقع تزيد وضوح العطل: **Start متفائل محليًا قبل confirmation**. لذلك الإصلاح الآمن يجب أن يعالج العقدين معًا في خطة واحدة، مع عدم تغيير gameplay:

- Rules يجب أن تسمح فقط للـhost بتحديث الحقول المقصودة في مرحلة Start.
- UI/state يجب ألا يعرض نجاحًا نهائيًا قبل نجاح العملية، أو يجب أن يملك rollback صريحًا ونظيفًا عند الرفض.

لا يعني ذلك أن نفتح `.write` على الغرفة أو نسمح للاعبين بتعديل phase. المطلوب child-level allowlist محددة مع validation للأنواع والقيم والمرحلة.

## 7. وضع 2v2 وFour

الأدلة المصدرية لا تسمح بقول إن 2v2 وFour لديهما نفس العطل حرفيًا.

`CompetitiveModeContext.jsx:154-176` يثبت أن الوضعين التنافسيين:

- يستقبلان الحالة من `subscribeCompetitiveRoom`.
- لا يرسلان local phase dispatch متفائلًا مثل 1v1.
- `startMode()` يبني الحالة ثم ينتظر `writeCompetitiveState()` و`writePrivateTargets()`.
- يبقيان على route واحدة ويعرضان حسب الحالة، بدل navigation إلى `/game` ثم redirect.

إذًا:

| الوضع | نتيجة التحقيق الحالية |
|---|---|
| 1v1 | Root cause مؤكد: Start fan-out مرفوض بسبب timestamp Rules children، ثم snapshot lobby يعيد التوجيه. |
| 2v2 | نفس نمط Rules mismatch محتمل فقط إذا كانت حقول competitive state غير مغطاة؛ لا يوجد دليل حي/Emulator كامل هنا يثبت نفس الفشل. |
| Four | نفس التحفظ؛ له بنية tournament مختلفة، وprivate target/match fields يجب اختبارها منفصلًا. |

لا يجوز تعميم إصلاح 1v1 على 2v2/Four بدون مصفوفة paths خاصة بكل mode.

## 8. المخاطر المستقبلية التي يجب فحصها قبل الإصلاح

1. أي field جديد في `writeCompetitiveState` بلا child rule قد يفشل update كله.
2. multi-location update يفشل بالكامل إذا رفض مسار واحد.
3. `syncBeginPlaying()` يستخدم transaction على الغرفة ثم يكتب private targets؛ نجاح الأولى لا يثبت نجاح الثانية.
4. private target writes يجب أن تبقى host-only للكتابة وowner-only للقراءة.
5. target payload يجب أن يثبت `playerId`, `matchId`, `roundId/roundNumber`, و`targetReady`.
6. host migration قد يغير صلاحية الكتابة، ويجب اختبارها لا افتراضها.
7. Refresh قد يعيد session stale ويستدعي join/reconnect بمسار Rules مختلف.
8. Leave/remove قد يحاول الكتابة بعد تغير phase إلى finished.
9. race بين Start من host وsnapshot lobby قد ينتج rollback حتى بعد إصلاح Rules إذا بقي optimistic dispatch بلا confirmation.
10. أخطاء `update()` و`transaction()` يجب أن تُعرض مع stage/operation، لا برسالة عامة فقط.
11. عدم تطابق القواعد في Firebase Console مع `database.rules.json` يخلق Rules drift.
12. اختبار Rules Playground على `/` لا يثبت صلاحية `/rooms/<code>`؛ root deny يجب أن يبقى.
13. اختبار Auth provider غير المطابق لـAnonymous قد يعطي نتيجة غير ممثلة للموقع.
14. absence of explicit `.validate` لكل field قد يسمح payload صالحًا شكليًا لكنه غير آمن.
15. parent `.write` الواسع قد يفتح تعديل phase/targets للاعبين إذا أضيفت لاحقًا قاعدة ancestor خاطئة.
16. إعادة المحاولة قد تكرر Start أو target fan-out؛ يجب أن تبقى العمليات idempotent.
17. فشل كتابة private target بعد shared state قد يجعل الشاشة تظهر بلا target صالح.
18. `status` و`phase` يجب أن ينتقلا معًا ولا يُسمح بحالة مختلطة.
19. room-code enumeration يجب ألا يكشف بيانات غرفة غير lobby للأشخاص غير الأعضاء.
20. أي إصلاح Rules يجب اختباره negative: لاعب غير Host، UID آخر، غرفة أخرى، phase غير مناسبة، payload ناقص، وقيمة timestamp خاطئة.

## 9. التصميم الإصلاحي المقترح — دون تنفيذ

### 9.1 حزمة A: إصلاح Rules محدود

إضافة قواعد child-level للحقول التي يكتبها Host في Start Preview، بنفس نمط الحقول الموجودة، مع شروط:

- `auth != null`.
- `data.parent().child('hostId').val() === auth.uid`.
- عدم منح أي صلاحية للاعب غير Host.
- السماح فقط بالقيم التي يرسلها عقد Start الحالي.
- إضافة `.validate` للرقم أو null حيث يلزم.
- عدم فتح parent `.write` على غرفة موجودة.
- عدم تغيير Rules الخاصة بـ`privateRooms` بما يعرّض ownTarget أو displayTarget.

ينبغي تحديد ما إذا كانت `transitionStartedAt` و`transitionEndsAt` و`revealEndTimestamp` أرقامًا دائمًا أم تسمح بـnull وفق payload الفعلي، ثم كتابة validation مطابق قبل النشر.

### 9.2 حزمة B: إصلاح state confirmation

من دون تغيير gameplay، يجب تصميم واحد من خيارين:

- انتظار نجاح `syncEnterPreview()` قبل اعتبار Start مؤكدًا، ثم السماح بالعرض.
- أو الإبقاء على optimistic UI لكن عند فشل sync تنفيذ rollback واضح إلى lobby مع رسالة operation-specific، ومنع route flash المضلل.

الاختيار يجب أن يحافظ على نفس phase semantics، نفس rounds، ونفس targets.

### 9.3 حزمة C: contract tests

إضافة اختبار يطابق كل field في `syncEnterPreview` مع Rule allowlist، واختبار emulator يثبت:

- Host يستطيع Start من lobby.
- Player غير Host لا يستطيع Start.
- Player لا يستطيع تعديل phase/status/timestamps.
- Start payload ناقص أو timestamp غير رقمي مرفوض.
- عملية Start لا تسمح بتغيير targets المشتركة.
- غرفة A لا تُقرأ أو تُكتب من لاعب غرفة B.

### 9.4 حزمة D: competitive matrix

بناء probes مستقلة لـ2v2 وFour، لأن `teamRooms` و`tournamentRooms` لهما state models مختلفة. يجب استخراج كل fields من `writeCompetitiveState`، ثم اختبار كل transition على حدة قبل إنتاج أي Rules جديدة.

## 10. ترتيب التنفيذ المقترح بعد موافقة المستخدم

1. أخذ snapshot للنسخة الحالية والـRules المنشورة دون تغيير.
2. تسجيل كل fields في `syncEnterPreview` و`syncBeginPlaying`.
3. إضافة Rules child-level للحقول المفقودة فقط.
4. إضافة `.validate` لكل timestamp/phase/status field.
5. كتابة Rules emulator tests موجبة وسلبية لمسار 1v1.
6. اختبار state rollback/confirmation في بيئة محلية.
7. بناء مصفوفة paths مستقلة لـ2v2.
8. بناء مصفوفة paths مستقلة لـFour.
9. تشغيل full regression/build/pages contract.
10. نشر GitHub Pages فقط بعد نجاح المصدر والاختبارات.
11. نشر Rules يدويًا في `neon-guess-test` فقط بعد مراجعة diff.
12. إنشاء غرفة 1v1 جديدة والتحقق من Start بعميلين مستقلين.
13. تكرار التحقق لـ2v2 وFour.
14. اختبار Refresh/Reconnect/Leave بعد وجود match فعلي.
15. اختبار private target visibility وعدم كشف ownTarget.
16. تحديث readiness report وعدم إعلان READY قبل اكتمال live evidence.

## 11. حدود ما تم وما لم يتم

**تم إثباته:**

- سبب رفض Start Preview في 1v1 داخل Rules Emulator.
- عدم وجود صلاحيات child للـtransition timestamp fields.
- أن الموقع ي dispatch محليًا قبل Firebase confirmation.
- أن listener/reducer يعيدان phase من Firebase.
- أن GameBoard يوجه lobby إلى خارج شاشة اللعب.
- أن 2v2/Four لا يستخدمان نفس navigation pattern المتفائل في 1v1.

**لم يتم إثباته بعد:**

- أن Firebase Console المنشور حاليًا مطابق 100% للملف المحلي.
- نجاح الإصلاح المقترح حيًا، لأنه لم يُنفذ.
- اكتمال Start fan-out في 2v2 وFour.
- Refresh/Leave/private target live evidence بعد match حقيقي.
- الجاهزية النهائية READY.

## 12. الحكم

**الحالة: CONDITIONAL / START BLOCKED في 1v1.**

العطل الحالي له root cause مؤكد في عقد Rules لمسار Start Preview، وتضخمه آلية optimistic navigation/state في الموقع. لا ينبغي حلّه بفتح قواعد عامة أو تعطيل Security. الحل الصحيح هو إصلاح allowlist الحقول المفقودة، ثم اختبار lifecycle كامل لكل وضع، ثم التحقق الحي بعملاء مستقلين.

هذا التقرير لا ينفذ أي تعديل. أي تنفيذ لاحق يجب أن يظل داخل Recommendation and Idea Developing، ويستخدم `neon-guess-test` فقط، ويحافظ على gameplay، targets، rounds، scoring، timers، teams، brackets، والـnavigation semantics.
