# NEON GUESS — مقترحات Firebase Rules والأمان القابلة للتنفيذ

**المشروع:** Recommendation and Idea Developing  
**البيئة المسموح بها:** Firebase `neon-guess-test` فقط  
**التاريخ:** 26 أغسطس 2026  
**نوع الوثيقة:** تصميم حلول ومواصفات تنفيذية — **دون تعديل أو نشر في هذه المرحلة**  
**الأوضاع:** 1v1، 2v2، Four  
**الكاتب:** Manus AI

## 1. الغرض والنتيجة المطلوبة

هذه الوثيقة تحول نتائج التدقيق السابق إلى مواصفات عملية لقواعد الصلاحيات والأمان. الهدف ليس جعل Firebase مفتوحًا حتى تختفي رسالة `PERMISSION_DENIED`، بل جعل كل عملية شرعية في الموقع مسموحة **في المسار والمرحلة والممثل الصحيحين فقط**، مع رفض كل محاولة من مستخدم آخر أو غرفة أخرى أو مرحلة قديمة.

لا توجد قاعدة يمكن وصفها بأنها “لا يمكن أن تسبب أي مشكلة” قبل تشغيلها على Emulator ثم على Firebase Test ببيانات حقيقية وعملاء مستقلين. لذلك المقترحات أدناه مصممة لتقليل أخطاء الرفض غير المقصودة، مع اختبارات قبول تمنع نشر أي قاعدة غير مثبتة. Firebase يقيّم Rules على الخادم، وتُرفض العملية إذا لم يمر كل مسار متأثر بالتفويض والتحقق المناسبين [1] [2]. كما أن `update()` قد ينفذ fan-out متعدد المسارات، ولذلك يجب اختبار العملية كاملة لا حقلًا واحدًا فقط [3].

> **القرار الموصى به:** اعتماد **Proposal A — Field-Level Lifecycle Authorization**، وتنفيذه على مراحل صغيرة تبدأ بإثبات فشل Start/Join الحالي، ثم إضافة أقل صلاحيات child اللازمة، مع negative tests قبل النشر.

## 2. عقد المنتج المحمي

هذه المقترحات لا تسمح بأي تغيير في gameplay. تبقى القواعد التالية ثابتة:

| العقد المحمي | ما يعنيه أمنيًا |
|---|---|
| 1v1 و2v2 وFour تعمل بالقواعد الحالية | Rules تحمي التدفق ولا تعيد تصميمه |
| اللاعب يرى target الخصم المقصود له | لا تُفتح `ownTarget` لمجرد معالجة الرفض |
| اللاعب لا يرى target المعيّن له | private target يبقى خارج القراءة العامة |
| الجولات والـtimers والنتائج لا تتغير | authorization لا يغير التوقيت أو الحساب |
| الفرق والمقاعد والـbrackets لا تتغير | Rules تمنع التلاعب بها بدل إعادة تفسيرها |
| capacity وJoin semantics لا تتغير | القاعدة تطبق الحد الموجود، ولا تضيف سلوكًا جديدًا |
| Firebase Test فقط | لا نشر إلى Page أو إنتاج |

## 3. مقارنة المقترحات

| المقترح | الوصف | الميزة | الخطر | القرار |
|---|---|---|---|---|
| **A. Field-Level Lifecycle Authorization** | صلاحية منفصلة لكل lifecycle ولكل child متأثر | أقوى توازن بين availability وsecurity | يحتاج مصفوفة اختبارات كبيرة | **موصى به** |
| B. Minimal Field Allowlist | إضافة الحقول المفقودة فقط إلى Rules الحالية | أقل تغيير وأسرع | قد يترك فجوات غير مكتشفة | يستخدم كبداية داخل A بعد إثبات الفشل |
| C. Parent Host Write | السماح للـHost بالكتابة على room parent | قد يخفي عدة denials بسرعة | خطر تلاعب phase/score/targets/results | **مرفوض** |
| D. Client Retry/Ignore | إعادة المحاولة أو تجاهل Permission Denied | لا يمس Rules | يخفي فشلًا authoritative ويخلق state divergence | **مرفوض** |

## 4. Proposal A — التصميم الموصى به

### 4.1 المبدأ الأساسي

لا تستخدم قاعدة واحدة من نوع “المستخدم المصادق يستطيع الكتابة في الغرفة”. بدلًا من ذلك، عرّف لكل عملية:

1. الممثل المسموح: Host، اللاعب نفسه، عضو الفريق، أو authority الموجودة في النظام.
2. المرحلة المسموح بها: lobby، preview، playing، reveal، result، cleanup بحسب الحالة الحالية القائمة.
3. الغرفة والمباراة والجولة: يجب أن يطابق الطلب بيانات الغرفة الحالية.
4. الحقول المسموحة: لا يُقبل arbitrary-field write.
5. الانتقال المسموح: `data` للحالة القديمة و`newData` للحالة المدمجة الجديدة.
6. الاختبار المقابل: نجاح للفاعل الشرعي وفشل للفاعل غير الشرعي.

Firebase يفرق بين `data` قبل الكتابة و`newData` بعد دمجها، وهو الفرق الحاسم بين إنشاء غرفة جديدة وتحديث غرفة موجودة [2].

### 4.2 البنية العامة للمسارات

| المجال | 1v1 | 2v2 | Four |
|---|---|---|---|
| الغرفة العامة | `rooms/<code>` | `teamRooms/<code>` | `tournamentRooms/<code>` |
| اللاعبون | `players/<uid>` | `players/<uid>` مع seat/team | `players/<uid>` مع bracket/match context |
| الحجز | `joinSlots` أو البنية الحالية | seats/team slots الحالية | tournament seats/slots الحالية |
| scores | score map الحالية | score/team map الحالية | match/standing score map الحالية |
| الحالة authoritative | phase/status/round الحالية | lifecycle/team battle fields الحالية | bracket/match lifecycle الحالية |
| البيانات الخاصة | private target branches الحالية | private target branches الحالية | private target branches الحالية |

لا يُسمح بنقل بيانات من `rooms` إلى `teamRooms` أو العكس، ولا بتوحيد المسارات بطريقة تغيّر adapter أو gameplay. التوحيد المطلوب هو في **مبادئ التفويض والاختبار** فقط.

## 5. قواعد Auth والهوية

Anonymous Authentication يوفر UID مصادقًا عليه، لكنه مؤقت ويحتاج إلى اكتمال sign-in قبل اعتماد UID في الطلب [4]. لذلك يجب أن تتبع كل عملية هذا العقد:

| الحالة | السلوك المطلوب |
|---|---|
| `auth == null` | رفض Create/Join/Start/Action/Leave الذي يتطلب هوية |
| Auth لم يكتمل بعد | لا تبدأ transaction قبل توفر UID |
| UID موجود | اربط كل player/slot/presence/action به |
| UID مختلف عن الموجود | رفض، وعدم محاولة إصلاحه بتحويل الهوية |
| Anonymous sign-in rate limit | سجّلها كـAuth incident منفصل، لا كـRTDB Rules failure |
| إعادة فتح الصفحة | استرجع الجلسة فقط إذا طابقت UID والغرفة والمرحلة |

رسالة المتصفح `online` لا تكفي لإثبات أن Firebase Auth token جاهز أو أن Rules رأت UID الصحيح. يجب أن يحمل diagnostic `authReady` وUID redacted ومرحلة العملية.

## 6. قواعد Create Room

### 6.1 العقد الشرعي

يسمح Create فقط لمستخدم مصادق بإنشاء غرفة جديدة عندما تكون العقدة غير موجودة (`data.exists() == false`) ويكون `newData` مطابقًا لشكل lobby الحالي، بما فيه host UID، category، capacity، status/phase، وحقول الغرفة المعتمدة.

### 6.2 الممنوع

يُرفض overwrite لغرفة موجودة، إنشاء غرفة بلا host صحيح، تغيير capacity من العميل، إضافة حقول arbitrary، إنشاء غرفة في mode path آخر، أو استخدام UID غير UID المصادق.

### 6.3 transaction read

إذا كان SDK ينفذ transaction على عقدة الغرفة الجديدة، يجب أن تكون القراءة اللازمة للحالة غير الموجودة مسموحة بالحد الأدنى (`!data.exists()` أو العقد الحالي المكافئ)، دون فتح قراءة root. نجاح Rules Playground عند `/` ليس شرطًا؛ إغلاق الجذر صحيح أمنيًا.

## 7. قواعد Join Room

### 7.1 التسلسل المطلوب

يُعامل Join كدورة مؤلفة من حدود منفصلة:

1. قراءة أو transaction للـslot المطلوب.
2. حجز slot فارغ للمستخدم الحالي.
3. إنشاء player record مربوط بـ`auth.uid`.
4. تهيئة score الأولي فقط بعد وجود player record.
5. تنفيذ final verification أو listener على أقل مسار لازم.

كل خطوة تحتاج contract واضحًا. لا يجوز إعطاء صلاحية parent واسعة لأن score initialization فشل.

### 7.2 شروط slot

يسمح للاعب المصادق بحجز slot شاغر فقط، عندما تكون الغرفة في lobby والـslot داخل capacity الحالية، ويكون UID هو UID الطالب. يرفض النظام slot المشغول، seat خارج الحدود، room mode المختلف، ومحاولة الكتابة في غرفة أخرى.

### 7.3 شروط player record

يسمح للاعب بإنشاء سجله الذاتي فقط إذا كان slot محجوزًا له، والغرفة في المرحلة المناسبة، وحقول الاسم/الهوية ضمن schema الحالي. لا يجوز تغيير host أو team أو bracket أو target أو score من خلال Join payload.

### 7.4 شروط score initialization

يسمح للاعب نفسه بكتابة القيمة الابتدائية `0` في سجله فقط إذا كان player record موجودًا، والغرفة ما زالت في lobby، والعملية ليست overwrite لنتيجة قائمة. يظل aggregate score أو score map authoritative تحت actor الموجود في النظام، ولا تتحول تهيئة `0` إلى صلاحية تغيير score لاحقًا.

هذه النقطة هي علاج تصميمي لمشكلة Join السابقة، لكنها لا تُعتبر Live Firebase Verified إلا بعد نشر Rules المقابلة يدويًا في `neon-guess-test` واختبار هاتفين مستقلين.

## 8. قواعد Start وPreview

### 8.1 سبب التركيز

المصدر يرسل في 1v1 fan-out إلى غرفة موجودة. الحقول التي يجب تدقيقها صراحة تشمل الحقول التي ظهرت في `syncEnterPreview()` مثل `phase` و`status` و`round` و`roundResult` و`bracket` و`playerAssignments` و`matchResults` و`standings` و`revealEndTimestamp` و`transitionStartedAt` و`transitionEndsAt` و`timerEndTimestamp`.

### 8.2 العقد المطلوب

يسمح للـHost الحالي فقط بتنفيذ **نفس fan-out الحالي** عندما تكون الغرفة في lobby، واللاعبون يحققون شرط البدء الموجود أصلًا، والـcategory والـcapacity والحالة متطابقة. يجب أن يمر الطلب كاملًا في اختبار واحد.

لا يجوز إضافة parent write شامل. يجب إضافة child authorization فقط للحقول التي يثبت trace أن التطبيق يكتبها، وبشروط host/phase/old-state/new-state. إذا كان حقل غير ضروري أو لم يعد جزءًا من العقد، يجب أولًا إثبات ذلك ومراجعة gameplay contract؛ لا يُحذف من client sync تلقائيًا.

### 8.3 الاختبارات المطلوبة

| الاختبار | النتيجة |
|---|---|
| Host + full preview fan-out + valid lobby | `assertSucceeds` |
| Non-host + نفس fan-out | `assertFails` |
| Host + stale phase | `assertFails` |
| Host + field خارج allowlist | `assertFails` |
| Host + محاولة تغيير score/target/result | `assertFails` |
| Valid fan-out مع room أخرى | `assertFails` |
| Fan-out بعد Leave/closed room | `assertFails` |

## 9. قواعد Begin Round وprivate targets

### 9.1 المبدأ

Begin Round مرحلة مختلفة عن Start/Preview. يجب أن تبقى كتابة target authority في المسارات الخاصة الحالية، ولا يجوز نقل target إلى public room state. Firebase Rules لا ينبغي أن تستخدم field name مثل `ownTarget` لتقرر القراءة؛ القرار تابع لعقد المنتج: اللاعب لا يقرأ الهدف المعيّن له، ويرى فقط target الخصم المخصص للعرض [1] [2].

### 9.2 مصفوفة القراءة

| القارئ | public room | own assigned target | opponent-facing display target |
|---|---:|---:|---:|
| outsider | يرفض أثناء اللعب وفق العقد | يرفض | يرفض |
| عضو غير معني | الحد الأدنى فقط | يرفض | يرفض أو يسمح فقط إذا كان viewer المقصود |
| اللاعب | الحد الأدنى | **يرفض** | يسمح للهدف المقابل له |
| Host | حسب العقد الحالي | لا يفتح القراءة العامة | يقرأ فقط ما تحتاجه authority الحالية |

أي تعديل يجعل target readable للـplayer لتجنب denial هو **Product/Security violation** وليس إصلاحًا.

## 10. قواعد 2v2

2v2 يستخدم `teamRooms` ومسارًا تنافسيًا مختلفًا. التصميم الأمني المطلوب:

- اللاعب لا يحجز إلا seat مسموحًا له، ولا يتجاوز capacity الحالية.
- team assignment والـseat movement لا يغيران منطق الفرق الموجود؛ Rules تمنع أي كتابة من خارج المسارات والـactors الشرعيين.
- Start/preview وBegin Round يكتبان فقط الحقول التي يكتبها `competitiveFirebase.js`، وتُختبر fan-outs كاملة.
- score الفردي أو الجماعي لا يكتبه اللاعب بحرية؛ تهيئة السجل الابتدائي منفصلة عن aggregate authority.
- player من Team A لا يكتب Team B، ولا يغير seat لاعب آخر.
- target private/display isolation تطبق بنفس العقد، مع مراعاة viewer/teammate/opponent الحالي من دون إعادة تعريفه.
- Leave وRefresh لا يعيدان team أو seat من client payload غير موثوق.

اختبارات 2v2 يجب أن تشمل 1/4، 2/4، 3/4، 4/4، slot race، team seat، Start قبل اكتمال العدد، وcross-room access.

## 11. قواعد Four

Four يستخدم `tournamentRooms` وبنية bracket/match. قواعده يجب أن تفصل بين:

- إنشاء tournament lobby؛
- حجز participant seat؛
- player identity؛
- match/bracket state؛
- standings/results؛
- target private branches؛
- الانتقال بين المراحل الموجودة.

لا يسمح للاعب بكتابة bracket أو winner أو standings أو match result لمجرد أنه عضو. Host/authority يكتب الحالة authoritative وفق phase/match الحالية، واللاعب يكتب فقط event المسموح له في match/round المحدد إن كان العقد الحالي يسمح بذلك.

اختبارات Four يجب أن تمنع stale match writes، إعادة إرسال result، الكتابة إلى match أخرى، تغيير bracket من لاعب، وقراءة target من participant غير viewer المقصود.

## 12. Refresh وReconnect وPresence

Refresh ليس Join جديدًا تلقائيًا. يجب أن يطابق UID الحالي player record الموجود، ويعيد الاشتراك في أقل listener path مطلوب، ولا يعيد ضبط phase أو score أو target أو seat. Presence يكتب في سجل اللاعب الحالي فقط. عند اختلاف UID أو انتهاء الغرفة، يجب إظهار recovery state واضح بدل تنفيذ mutation غير مصرح.

يجب تنظيف listeners عند Leave أو route change، لأن listener قديم قد يقرأ أو يعيد state من غرفة أُغلقت. توصي Firebase باستخدام listeners على أقل مستوى مفيد وبتنظيفها، كما توصي بقياس الاستخدام قبل أي optimization [3] [5].

## 13. Leave وCleanup

Leave يجب أن يظل عبر مسار المنتج الحالي، لا عبر حذف REST قسري. يسمح للاعب بإزالة/تحديث بياناته الذاتية فقط وفق schema الحالي، ويسمح للـHost أو authority بتنظيف ما ينص عليه العقد. يرفض outsider أي delete، ويمنع compound cleanup من حذف private targets أو لاعبين آخرين بلا شرط صريح.

أي Permission Denied في غرفة مغلقة يجب توثيقه كحالة cleanup/closed-room، لا علاجه بفتح delete عام.

## 14. Validation وpayload allowlist

كل path شرعي يجب أن يرفض:

- حقولًا غير معروفة؛
- أنواعًا غير صحيحة؛
- أسماء أو رسائل أكبر من الحدود المقصودة؛
- UID مختلفًا عن `auth.uid`؛
- phase/round/match غير الحالية؛
- timestamp غير منطقي حسب العقد؛
- تغييرًا في target أو score أو result من actor غير مخول.

`validate` يجب أن يغطي كل عقدة غير محذوفة متأثرة، لأن validation لا تعمل كتفويض كتابة متسلسل مثل `.write` [2].

## 15. مصفوفة الاختبار الموحدة

### 15.1 Positive tests

| المجال | 1v1 | 2v2 | Four |
|---|---:|---:|---:|
| Create fresh room | نعم | نعم | نعم |
| Independent Join | نعم | نعم | نعم |
| Capacity boundary | نعم | نعم | نعم |
| Host Start complete fan-out | نعم | نعم | نعم |
| Begin Round | نعم | نعم | نعم |
| Valid action | نعم | نعم | نعم |
| Refresh/reconnect | نعم | نعم | نعم |
| Leave | نعم | نعم | نعم |

### 15.2 Negative tests

| الهجوم/الخطأ | يجب أن يفشل |
|---|---|
| unauthenticated Create/Join | نعم |
| non-host Start | نعم |
| outsider room read during playing | نعم |
| cross-room write | نعم |
| ownTarget read by assigned player | نعم |
| target write by client | نعم |
| score overwrite by joiner | نعم |
| slot theft | نعم |
| capacity overflow | نعم |
| stale phase/round/match write | نعم |
| replayed action/result | نعم |
| arbitrary field injection | نعم |
| wrong UID player mutation | نعم |
| bracket/result tampering | نعم |
| unauthorized delete | نعم |

## 16. خطة التنفيذ الآمنة بعد موافقة المستخدم

### الحزمة 1 — إثبات البيئة

تسجيل repository، branch، commit، Firebase project ID، RTDB URL، Rules revision، ونسخة Pages. إذا كان أي عنصر غير مؤكد، يتوقف التنفيذ.

### الحزمة 2 — Regression قبل الإصلاح

إضافة/تشغيل اختبارات كاملة لـJoin وStart fan-out، مع Host/non-host وcross-room وstale cases. يجب أن يُظهر الاختبار الفشل الحالي أو يوضح لماذا لم يعد قابلاً لإعادة الإنتاج.

### الحزمة 3 — إصلاح Join محدود

تطبيق score-child authorization الضيق فقط إذا ظل هذا هو الفرق المؤكد، ثم تشغيل transaction/player/score isolation tests. لا تغييرات في gameplay.

### الحزمة 4 — إصلاح Start محدود

بعد التقاط diagnostic Start، إضافة child rules فقط للحقول التي يكتبها fan-out الحالي، بشروط Host وphase وnewData. منع parent blanket write.

### الحزمة 5 — تغطية Begin Round والـtargets

اختبار كامل للـprivate target paths مع allow/deny لكل actor. أي فشل خصوصية يوقف النشر.

### الحزمة 6 — تغطية 2v2 وFour

تشغيل adapter-specific tests للـteamRooms وtournamentRooms، مع capacity/team/bracket/match isolation.

### الحزمة 7 — Lifecycle resilience

اختبار Refresh/Reconnect/Presence/Leave/closed room/host departure، دون تغيير سلوك المنتج.

### الحزمة 8 — Release gate

Build، source contracts، Rules emulator، negative tests، Pages routes، ثم LIVE Test بعملاء مستقلين. Firebase Rules تُنشر يدويًا في Test فقط وبعد موافقة المستخدم.

## 17. النشر والرجوع

لا يكفي دفع commit إلى GitHub؛ GitHub Pages ينشر web bundle، وليس RTDB Rules. لذلك يجب أن يحتوي كل نشر على:

| بوابة | شرط المرور |
|---|---|
| Repository | المستودع الصحيح Recommendation and Idea Developing |
| Firebase | `neon-guess-test` فقط |
| Rules source | ملف معروف ومراجعته محفوظة |
| Console | publish version/time موثق |
| Emulator | positive وnegative passes |
| Browser | route/build smoke pass |
| Multi-client | عميلان أو أربعة بحسب mode |
| Privacy | ownTarget denial مثبت |
| Rollback | نسخة Rules السابقة محفوظة |

إذا فشل LIVE بعد النشر، يُقارن أولًا Rules revision وbundle revision قبل أي تعديل آخر. لا تُحذف بيانات الغرف يدويًا ولا تُستخدم destructive REST operations.

## 18. ما يعتبر جاهزًا وما لا يعتبر جاهزًا

| الحالة | معناها |
|---|---|
| `SOURCE VERIFIED` | المسار والقواعد موثقان من المستودع |
| `RULES VERIFIED` | Rules المنشورة في Test مطابقة ومختبرة |
| `TEST VERIFIED` | اختبارات الكود/Emulator نجحت |
| `RUNTIME VERIFIED` | المتصفح شغّل العملية فعليًا |
| `MULTI-CLIENT VERIFIED` | عملاء مستقلون أثبتوا التزامن والعزل |
| `GAMEPLAY CONTRACT VERIFIED` | لم يتغير target/round/score/timer/winner behavior |
| `READY` | كل بوابات الإصدار الحرجة مكتملة |
| `CONDITIONAL` | بعض الأدلة أو العملاء أو النشر غير مكتمل |
| `BLOCKED` | فشل حرج أو بيئة غير متاحة |

الحالة الحالية من واقع الأدلة السابقة: **CONDITIONAL — NOT READY**. لا يجوز تحويلها إلى READY بمجرد أن ينجح Rules Playground عند `/` أو ينجح Create من عميل واحد.

## 19. الخلاصة التنفيذية

الحل الصحيح هو **قواعد دقيقة واسعة التغطية، وليست قواعد واسعة الصلاحية**. Proposal A يحقق ذلك عبر فصل lifecycle، وربط كل كتابة بالـUID والـactor والمرحلة والـroom/match/round، واختبار fan-out كاملًا، وحماية private targets، وفصل source/live Rules، وتشغيل negative tests قبل أي نشر.

لا يوجد في هذه الوثيقة تعديل مطبق. الخطوة التنفيذية التالية الآمنة هي التقاط diagnostic كامل لخطأ Start الحالي، ثم بناء emulator test للعملية نفسها. بعد إثبات أول field فاشل، ينفذ أقل إصلاح ممكن داخل `neon-guess-test` فقط.

## References

[1]: https://firebase.google.com/docs/database/security "Firebase Realtime Database Security Rules"

[2]: https://firebase.google.com/docs/database/security/rules-conditions "Use conditions in Realtime Database Security Rules"

[3]: https://firebase.google.com/docs/database/web/read-and-write "Read and Write Data on the Web"

[4]: https://firebase.google.com/docs/auth/web/anonymous-auth "Authenticate with Firebase Anonymously"

[5]: https://firebase.google.com/docs/database/usage/optimize "Optimize Database Performance"

[6]: https://firebase.google.com/docs/emulator-suite/connect_rtdb "Connect your app to the Realtime Database Emulator"

[7]: https://firebase.google.com/docs/rules/unit-tests "Write unit tests for your Security Rules"

[8]: https://firebase.google.com/docs/database/security/test-rules-emulator "Test your Realtime Database Security Rules with the Emulator"

**الحالة النهائية:** **SECURITY REVIEW COMPLETE — REMAINING RISKS REQUIRE ATTENTION**
