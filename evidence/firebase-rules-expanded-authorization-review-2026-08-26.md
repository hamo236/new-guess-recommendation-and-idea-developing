# NEON GUESS — البحث الموسع في Firebase Rules ومنطق الصلاحيات

**التاريخ:** 26 أغسطس 2026  
**النطاق:** مستودع **Recommendation and Idea Developing** فقط، مع Firebase project **`neon-guess-test`** فقط  
**وضع العمل:** **Research / Review Only** — لم يتم تعديل المصدر أو Rules أو بيانات Firebase أو النشر أثناء إعداد هذا التقرير  
**الأوضاع محل المراجعة:** 1v1، 2v2، Four  
**القيود غير القابلة للتغيير:** لا تعديل في gameplay، targets، target visibility، rounds، scoring، timers، teams، brackets، capacity semantics، أو navigation meaning

## 1. الخلاصة التنفيذية

ظهور `PERMISSION_DENIED` لا يعني أن الحل هو فتح Firebase أو إزالة الحماية. النتيجة الأقوى من مراجعة المصدر والقواعد هي أن التطبيق والقواعد يعملان كـ **عقد صلاحيات متعدد المراحل**، لكن بعض عمليات التطبيق تكتب عدة مسارات في `update()` أو `transaction()` بينما لا توجد دائمًا قاعدة صريحة لكل حقل متأثر بالعملية. عندها يكفي أن يفشل مسار واحد حتى تفشل العملية المركبة كلها.

في 1v1، توجد أدلة مصدرية قوية على أن مسار Start/Preview يكتب fan-out إلى غرفة موجودة، ومن ضمن الحقول التي ظهرت في التتبع: `phase` و`status` و`round` و`roundResult` و`bracket` و`playerAssignments` و`matchResults` و`standings` و`revealEndTimestamp` و`transitionStartedAt` و`transitionEndsAt` و`timerEndTimestamp`. الحقول الأخيرة تحديدًا ظهرت كمرشحين لمشكلة غياب تصريح child واضح في Rules الحالية. هذا **سبب مصدر مرجح بدرجة عالية**، لكنه ليس إثباتًا حيًا نهائيًا للحقل المحدد قبل التقاط `Stage/Code/Correlation` من محاولة Start جديدة ومقارنة نسخة Rules المنشورة.

في Join، تم سابقًا رصد فشل حي من هاتف مستقل في مرحلة `join-transaction` مع `PERMISSION_DENIED`. كما تم إعداد إصلاح محدود في المصدر وملف Rules لمسار score initialization، لكن نشر GitHub Pages لا ينشر RTDB Rules تلقائيًا. لذلك تظل مطابقة القواعد المنشورة في Console مع `database.rules.json` نقطة تحقق مستقلة، ولا يجوز اعتبار commit أو نجاح build دليلًا على أن Firebase يستخدم النسخة نفسها.

**الحكم الحالي:** `CONDITIONAL — NOT READY`. السبب ليس وجود دليل على أن كل شيء مكسور، بل عدم اكتمال الدليل الحي المستقل لكل مسارات Create/Join/Start/Begin Round/Refresh/Leave/Privacy في الأوضاع الثلاثة.

## 2. حدود الدليل

| التصنيف | ما يثبته | ما لا يثبته |
|---|---|---|
| SOURCE VERIFIED | ما يكتبه الكود وما تسمح أو تمنع به القواعد الموجودة في المستودع | أن Firebase Console منشور عليه الملف نفسه |
| BUILD VERIFIED | أن الاختبارات والبناء وartifact contracts نجحت | أن عميل الهاتف يستخدم النسخة الجديدة أو أن Rules محدثة |
| EMULATOR VERIFIED | أن قواعد الملف تنجح أو تفشل في سيناريوهات محلية محددة | أن الشبكة والهوية والـAuth في الهاتف مطابقان تمامًا |
| LIVE BROWSER | ما ظهر في الموقع المنشور | خصوصية target أو multi-client ما لم تُرَ بعملاء مستقلين |
| LIVE FIREBASE | طلب حقيقي وصل إلى Firebase وانتهى بنجاح أو رفض | سبب داخلي غير مسجل إذا لم توجد Stage/Correlation مفصلة |
| USER OBSERVED | الخطأ الذي رآه المستخدم | الحقل الذي تسبب في الفشل دون trace كامل |
| NOT VERIFIED | ما لم يُختبر بدليل مناسب | لا يجوز تحويله إلى READY |

## 3. المعمارية التي يجب أن تحكم Rules

الهيكل الصحيح ليس “اسمح للمصادق عليه أن يكتب في الغرفة”. الهيكل الصحيح هو **allowlist حسب العملية والممثل والمرحلة**:

1. `auth != null` شرط أساسي للعمليات التي تتطلب مستخدمًا.
2. `auth.uid` يجب أن يساوي UID الموجود في مسار اللاعب أو المقعد الذي يطالب به.
3. Host authorization يجب أن تتحقق من Host الحالي داخل الغرفة، لا من كون المستخدم مصادقًا فقط.
4. كل مسار gameplay authoritative يجب أن يكون Host-only أو مقيدًا باللاعب والـround والـmatch حسب العقد القائم.
5. private targets لا تُقرأ من public room state، ولا تُفتح لمجرد علاج Permission Denied.
6. `data` تعني الحالة قبل الكتابة، و`newData` تعني الحالة المدمجة بعد الكتابة؛ قواعد إنشاء الغرفة لا تكفي لتحديث غرفة موجودة.
7. `.validate` ليست بديلًا عن `.write`: لا بد من تصريح كتابة ثم تمرير validation لكل عقدة غير محذوفة.
8. العملية المركبة `update()` يجب اختبارها كاملة؛ اختبار حقل منفرد لا يثبت نجاح fan-out.
9. transaction تحتاج عقدة قراءة/صلاحية مناسبة للحالة القديمة والجديدة؛ إخفاء القراءة بالكامل قد يفشل transaction حتى لو كانت الكتابة النهائية تبدو صحيحة.
10. أي rule عامة في ancestor قد توسع الصلاحية أكثر مما يبدو، وأي غياب لتصريح parent لا يُعوّض تلقائيًا بكون المستخدم Host.

## 4. الأدلة الرسمية المستخدمة

- [Firebase Realtime Database Security Rules](https://firebase.google.com/docs/database/security): القواعد تُقيّم على الخادم، والعمليات تُرفض ما لم تسمح بها القواعد.
- [Use conditions in Realtime Database Security Rules](https://firebase.google.com/docs/database/security/rules-conditions): توثيق `auth` و`data` و`newData` و`root` و`$variables`، والفصل بين `.write` و`.validate`.
- [Read and Write Data on the Web](https://firebase.google.com/docs/database/web/read-and-write): توثيق `set()` و`update()` وmulti-location fan-out والـlisteners.
- [Authenticate with Firebase Anonymously](https://firebase.google.com/docs/auth/web/anonymous-auth): anonymous user هو UID مصادق عليه مؤقتًا، ويجب انتظار اكتمال Auth قبل الاعتماد على UID في Rules.
- [Optimize Database Performance](https://firebase.google.com/docs/database/usage/optimize): listeners منخفضة المسار، تنظيف listeners، قياس قبل التحسين، واستخدام multi-path updates بعناية.
- [Connect your app to the Realtime Database Emulator](https://firebase.google.com/docs/emulator-suite/connect_rtdb): تطابق project ID، demo projects، تنظيف البيانات، واستكشاف تغطية القواعد.
- [Build unit tests](https://firebase.google.com/docs/rules/unit-tests): `assertSucceeds` و`assertFails`، contexts مصادق عليها، ومسح بيانات emulator بين الاختبارات.
- [Set up the Local Emulator Suite](https://firebase.google.com/docs/database/security/test-rules-emulator): تشغيل واختبار Rules محليًا قبل النشر.

هذه المصادر لا تقول إن فتح القواعد هو الحل؛ بل تؤكد أن النموذج الصحيح هو قواعد دقيقة واختبارات كاملة للعمليات الحقيقية.

## 5. أين تظهر المشكلة حسب دورة المستخدم

### 5.1 Create Room

Create يختلف عن Join وStart لأن الغرفة الجديدة تكون `data.exists() === false`. قواعد `!data.exists()` التي تسمح بقراءة transaction لغرفة جديدة لا تعني أن المستخدم يستطيع تحديث غرفة موجودة لاحقًا. يجب أن تكون شروط الإنشاء وشروط التحديث منفصلة.

### 5.2 Join Room

Join في 1v1 يمر عادة بحدود منفصلة: قراءة/transaction للمقعد، إنشاء سجل اللاعب، وتهيئة score. في 2v2 وFour يوجد مسار مختلف في adapter وقواعد مختلفة (`teamRooms` و`tournamentRooms`). نجاح Create في عميل واحد لا يثبت نجاح Join من UID مستقل.

الفشل السابق `Stage: join-transaction` و`Code: PERMISSION_DENIED` يثبت أن الرفض وقع في Firebase authorization أثناء عملية الانضمام، لا أن المتصفح Offline. لكنه لا يحدد وحده هل المشكلة في slot reservation أو player record أو score initialization أو نسخة Rules المنشورة.

### 5.3 Start / Preview

Start لا يعني دائمًا Begin Round. في 1v1، الزر يمر عبر lobby handler ثم `startGame()` ثم `syncEnterPreview()` قبل الانتقال إلى `/game`. هذه العملية تكتب fan-out إلى غرفة موجودة. إذا غاب تصريح child لأي حقل من الحقول المتأثرة، قد يُرفض الطلب كله.

### 5.4 Begin Round / private targets

هذه مرحلة منفصلة وحساسة: تحديث حالة الغرفة ثم كتابة private `ownTarget` وviewer-facing `displayTarget`. لا يجوز إضافة صلاحية عامة لتجاوز فشلها، لأن ذلك قد يجعل اللاعب يقرأ هدفه أو يكتب هدف لاعب آخر.

## 6. مصفوفة مراجعة الصلاحيات المطلوبة

| السطح | الممثل الصحيح | السماح المطلوب | الرفض المطلوب |
|---|---|---|---|
| إنشاء غرفة جديدة | Host مصادق | إنشاء lobby صحيح فقط | غير مصادق، shape غير صحيح، overwrite لغرفة موجودة |
| قراءة lobby | لاعب مصادق | قراءة الحد الأدنى غير السري | root read، قراءة بيانات private |
| حجز slot | لاعب مصادق | slot شاغر، UID ذاتي، lobby صحيح | slot مشغول، UID آخر، غرفة أخرى |
| إنشاء player record | اللاعب نفسه | سجل يطابق UID والـslot والـphase | انتحال لاعب، تغيير host، حقول غير مسموحة |
| تهيئة score | اللاعب نفسه | قيمة أولية `0` بعد وجود player | رفع score، كتابة score لاعب آخر، overwrite |
| aggregate scores | Host/authority | تحديث authoritative مطابق للحالة | لاعب عادي أو outsider |
| Start/Preview | Host الحالي | الحقول المطلوبة فقط وفي المرحلة الصحيحة | non-host، stale phase، حقل خارج العقد |
| Begin Round | Host/authority | انتقال صحيح للـround الحالي | replay، round قديم، outsider |
| ownTarget | Host write / no client read | التخزين الداخلي المطلوب | قراءة اللاعب له أو كتابة clientية |
| displayTarget | viewer المسموح | رؤية target المقصود للعرض | قراءة target الخاص أو target غرفة أخرى |
| Guess/action | اللاعب المسموح | فعل للـround والـmatch الصحيح | فعل لاعب آخر أو round قديم |
| Vote/elimination | actor المسموح | حدث مطابق للـround | replay أو تغيير نتيجة authoritative |
| Chat/message | member وفق العقد | كتابة رسالة محدودة الحجم والهوية | outsider، spoof UID، payload كبير |
| Presence | اللاعب نفسه | تحديث presence الخاص | تغيير presence لاعب آخر |
| Refresh/reconnect | UID الموجود | استعادة الحالة دون reset | انضمام مزدوج أو تبديل UID |
| Leave | اللاعب نفسه أو Host وفق العقد | إزالة/تحديث محدود | حذف غرفة أو private state عشوائي |
| Host migration | النظام/Host وفق العقد | انتقال واضح ومحدود | privilege escalation أو سباق مزدوج |
| Cross-room | لا أحد خارج الغرفة | لا قراءة/كتابة لغرفة أخرى | enumeration mutation |

## 7. تحليل القواعد المتشددة

القواعد الحالية متشددة في أماكن صحيحة: إغلاق الجذر، ربط اللاعب بـUID، حماية private targets، وحصر الحالة authoritative. المشكلة ليست “Security كثيرة” بحد ذاتها، بل **عدم التطابق بين نطاق الكتابة في الكود ونطاق التفويض في Rules**.

أخطر شكلين من التشدد الخاطئ هما:

- السماح بالإنشاء فقط ثم توقع أن يرث Host صلاحية تحديث غرفة موجودة.
- تعريف صلاحية score أو player على مستوى يمنع multi-location update الشرعي، ثم محاولة علاج ذلك بمنح صلاحية parent واسعة.

والخطر المقابل هو العلاج الواسع: `.write` لأي authenticated user داخل room، أو فتح `rooms/$roomCode` للـHost بلا تقييد للحقول والمرحلة. هذا قد ينهي Permission Denied مؤقتًا لكنه يفتح تعديل phase، timer، assignments، score، result، أو targets.

## 8. بحث مضاد في المشاكل التي قد تظهر لاحقًا

| # | السيناريو المستقبلي | سبب Permission Denied المحتمل | الخطر الأمني المقابل إذا عولج خطأ |
|---:|---|---|---|
| 1 | Start preview | child transition/reveal غير مصرح | فتح تحديث الغرفة بالكامل |
| 2 | Join slot | transaction لا تستطيع قراءة الحالة المطلوبة | فتح قراءة الغرفة كلها |
| 3 | Player creation | UID/slot/phase mismatch | السماح بانتحال لاعب |
| 4 | Score init | parent/child validation متناقض | السماح بتغيير score |
| 5 | Duplicate Join | player موجود أو slot محجوز | overwrite أو duplicate identity |
| 6 | Full capacity | شرط count لا يطابق seats | زيادة السعة أو slot theft |
| 7 | Concurrent joins | سباق بين transaction وfan-out | partial state أو overwrite |
| 8 | Begin Round | field جديد غير موجود في Rules | blanket host write |
| 9 | Target fan-out | writer أو viewer condition غير متطابق | تسريب ownTarget |
| 10 | Guess/action | round/match stale | replay أو رفض شرعي غير مصنف |
| 11 | Vote | actor/target/team condition | تغيير elimination من outsider |
| 12 | Chat | member path أو validation | spam أو spoofing |
| 13 | Refresh | session UID مختلف أو stale local room | مسح الحماية أو إعادة join زائف |
| 14 | Reconnect | listener read أوسع من write | تسريب حالة private |
| 15 | Leave | compound delete بمسارات مختلفة | حذف غرفة أو بيانات خصم |
| 16 | Host leaves | انتقال host غير ذري | privilege escalation |
| 17 | Four bracket | كتابة match/result غير مصرح بها | تغيير bracket/winner |
| 18 | 2v2 team move | team/seat write غير مقيد | تغيير الفرق أو السعة |
| 19 | Cross-room | code enumeration وlobby read | metadata leakage |
| 20 | Stale client | replay لكتابة phase قديمة | state rollback |
| 21 | Rules drift | Console أقدم من commit | إصلاح مصدر بلا أثر حي |
| 22 | Auth not ready | `auth.uid` null لحظة الطلب | false denial أو retry غير آمن |
| 23 | Anonymous quota | فشل anonymous sign-in من IP | تشخيصه خطأ كـRTDB denial |
| 24 | Wrong environment | bundle يشير لقاعدة أخرى | اختبار نتيجة غير صحيحة |
| 25 | Listener cleanup | listener قديم يكتب أو يقرأ بعد Leave | state resurrection |
| 26 | Error wrapping | كل Firebase errors تظهر نفس الرسالة | إصلاح المرحلة الخطأ |
| 27 | Malformed payload | validation تفشل في child واحد | blanket relaxation |
| 28 | Large fan-out | أحد المسارات غير موجود في Rules | فشل كامل غير واضح |
| 29 | Expired room | cleanup أو TTL condition | حذف شرعي يفشل أو يبقى stale |
| 30 | Manual Playground | اختبار root `/` بدل room path | false conclusion بأن كل Rules مكسورة |

## 9. خطة البحث والتدقيق ذات المهام الكثيرة — دون تنفيذ

| Task | العمل البحثي | الدليل المطلوب | لا يُعتبر مكتملًا إلا إذا |
|---:|---|---|---|
| 1 | تسجيل diagnostic جديد لـStart | Stage/Code/Correlation/UID-role/mode | حُددت أول عملية فاشلة |
| 2 | تسجيل diagnostic جديد لـJoin | نفس الحقول مع room code | فُصل slot عن player عن score |
| 3 | مطابقة project identity | project ID وRTDB URL من bundle وConsole | لا يوجد احتمال بيئة خاطئة |
| 4 | حفظ Rules revision | publish timestamp/version من Console | عُرفت النسخة الحية |
| 5 | مقارنة Rules source/live | diff أحادي الاتجاه | كل drift مصنف |
| 6 | استخراج كل `set()` | جدول path/actor/phase | لا يوجد write غير مسجل |
| 7 | استخراج كل `update()` | fan-out كامل | كل child path معروف |
| 8 | استخراج كل transaction | read/write/rollback | شروط transaction موثقة |
| 9 | بناء مصفوفة 1v1 | Create/Join/Start/Begin/Action/Leave | كل operation لها allow/deny |
| 10 | بناء مصفوفة 2v2 | teamRooms/seats/teams | seat/team semantics محفوظة |
| 11 | بناء مصفوفة Four | tournamentRooms/bracket/matches | bracket/result authority واضحة |
| 12 | اختبار auth-ready | UID قبل وبعد onAuthStateChanged | لا طلب قبل الهوية |
| 13 | اختبار anonymous identity | UIDين مستقلين | لا اعتماد على Google UID في التطبيق |
| 14 | اختبار Start fan-out كامل | host complete update | نجاح العملية كاملة لا حقل منفرد |
| 15 | اختبار Start negative | non-host/stale host | الرفض مؤكد بلا side effect |
| 16 | اختبار Begin Round | host/phase/round | الحقول كلها authorized |
| 17 | اختبار target privacy | owner/viewer/opponent/outsider | ownTarget غير قابل للقراءة |
| 18 | اختبار Join atomicity | slot+player+score | لا partial unsafe state |
| 19 | اختبار duplicate/stale Join | same UID/old slot/full room | الرفض واضح وآمن |
| 20 | اختبار concurrent Join | عدة contexts emulator | السعة لا تتجاوز الحد |
| 21 | اختبار cross-room isolation | room A/B | لا قراءة أو كتابة عابرة |
| 22 | اختبار Refresh/Reconnect | session persistence | لا reset ولا duplicate |
| 23 | اختبار Leave | self/host/outsider | cleanup محدود وصحيح |
| 24 | اختبار actions/replay | old round/wrong actor | stale writes مرفوضة |
| 25 | اختبار messages/votes | payload/actor/phase | validation والهوية متطابقتان |
| 26 | اختبار host migration | simultaneous leave | لا privilege escalation |
| 27 | فحص listener scope | lowest useful path | لا root listeners أو private overread |
| 28 | فحص payload validation | types/length/allowed keys | malformed input مرفوض |
| 29 | فحص capacity | 1v1/2v2/Four boundaries | لا زيادة مقعد أو slot |
| 30 | فحص cleanup/expiry | stale room lifecycle | لا بقايا خطرة ولا حذف شامل |
| 31 | فحص Rules coverage | emulator coverage report | كل rule critical exercised |
| 32 | فحص negative coverage | assertFails لكل attack | الرفض موثق وليس مفترضًا |
| 33 | فحص deployment gate | source commit/Pages/Rules | artifacts متزامنة أو drift معلن |
| 34 | فحص rollback | نسخة Rules سابقة آمنة | رجوع Test-only قابل للتنفيذ |
| 35 | تشغيل release QA | عملاء مستقلون حقيقيون | LIVE evidence لكل mode |
| 36 | تصنيف النتيجة | READY/CONDITIONAL/BLOCKED | لا إعلان بلا gates مكتملة |

## 10. تصميم Rules المطلوب مستقبلًا

التصميم المقترح ليس ملف Rules جديدًا جاهزًا للنشر في هذه المرحلة، بل مواصفات يجب أن يحققها الإصلاح:

### 10.1 قواعد lifecycle صريحة

لكل مسار غرفة يجب الفصل بين:

- create-new-room؛
- lobby read؛
- slot claim؛
- player record؛
- score initialization؛
- host preview update؛
- begin-round update؛
- target fan-out؛
- actions/results؛
- leave/cleanup.

لا ينبغي استخدام parent `.write` واحد لتغطية كل هذه المراحل.

### 10.2 قواعد field-level للـfan-out

كل حقل يكتبه `update()` يجب أن يكون له واحد من الآتي: تصريح child صريح، أو تصريح ancestor مقصود ومثبت أنه لا يوسع صلاحيات الحقول الأخرى. يجب اختبار الـfan-out كاملًا ببيانات `data` و`newData` واقعية.

### 10.3 قواعد actor/phase

كل كتابة authoritative يجب أن تتحقق من actor والمرحلة الحالية والمرحلة الجديدة والـround والـmatch حيث ينطبق. لا يكفي `auth != null`.

### 10.4 قواعد private targets

تبقى private target branches منفصلة عن public room state. يجب أن يكون host هو writer المسموح وفق العقد، وأن تكون القراءة viewer-scoped، وأن يفشل owner read إذا كان العقد يمنع اللاعب من رؤية `ownTarget` الخاص به. لا يُسمح بحل Permission Denied عبر جعل `rooms/$code` readable بالكامل أثناء اللعب.

### 10.5 قواعد transaction

يجب توفير قراءة transaction بالحد الأدنى الضروري للحالة التي يحتاجها SDK، مع منع كشف البيانات الحساسة. إذا كان transaction يحتاج snapshot على parent، فتصمم القاعدة بحيث تسمح بالقراءة الضرورية فقط أو يعاد تصميم العملية دون تغيير gameplay، بعد إثبات الحاجة. لا يتم فتح root أو الغرفة أثناء اللعب عشوائيًا.

## 11. ما الذي لا يجوز فعله

لا تجعل `/` public read/write. لا تمنح authenticated user blanket write على الغرف. لا تمنح Host تحديثًا غير مقيد لكل children. لا تفتح ownTarget. لا تنقل targets إلى public state. لا تُسقط phase/round/match/UID checks. لا تعدّل gameplay فقط لإخفاء authorization failure. لا تستخدم Rules Playground على `/` كدليل على فشل كل النظام؛ رفض الجذر متوقع. لا تنشر Rules يدويًا قبل مقارنة الملف والنسخة والمشروع.

## 12. بوابة التنفيذ المستقبلية

إذا تمت الموافقة على التنفيذ لاحقًا، يجب أن يكون الترتيب الآتي:

1. التقاط diagnostic حقيقي لخطأ Start الحالي.
2. تثبيت Rules revision المنشورة في `neon-guess-test`.
3. إعادة إنتاج fan-out في emulator مع Host وnon-host.
4. تحديد أقل child/condition فاشل.
5. كتابة regression قبل الإصلاح أو بالتزامن معه.
6. تطبيق تعديل authorization-only محدود.
7. تشغيل Rules contract وnegative tests وmultiplayer isolation.
8. مراجعة diff وعدم لمس gameplay.
9. دفع المصدر إلى Recommendation and Idea Developing فقط.
10. نشر Rules يدويًا في Test فقط بعد موافقة المستخدم.
11. اختبار LIVE Join وStart من عملاء مستقلين.
12. اختبار 2v2 وFour والعزل وRefresh وLeave وtarget privacy.
13. إبقاء الحالة `CONDITIONAL` حتى اكتمال الدليل.

## 13. الحكم النهائي لهذا البحث

البحث يدعم بقوة أن سبب Permission Denied ليس أن Security Rules يجب أن تكون مفتوحة، بل أن **التصريح الحالي يجب أن يطابق كل عملية client fan-out بدقة**. توجد نقاط source-level مرشحة عالية الثقة في Start/Preview، وتوجد نقاط Join سبق إثبات فشلها حيًا، كما توجد مخاطر مستقبلية كثيرة في Begin Round، private targets، actions، cleanup، refresh، concurrency، وRules drift.

لكن لا يوجد في هذا التقرير أي إذن لتعديل القواعد أو الكود تلقائيًا، ولا يوجد دليل كافٍ لإعلان أن قاعدة واحدة بعينها هي السبب النهائي لخطأ Start الحالي دون diagnostic كامل. لذلك القرار المهني هو:

> **CONDITIONAL — بحث مكتمل، التنفيذ مؤجل، والـREADY محجوب حتى إثبات العملية الكاملة بعملاء مستقلين وقواعد منشورة مطابقة.**

## 14. قائمة الأدلة المحفوظة

- `evidence/firebase-rules-start-permission-review-2026-08-26.md` — التقرير السابق وتحليل Start الأولي.
- `evidence/firebase-rules-research-notes-2026-08-26.md` — ملاحظات المصادر الرسمية والبحث المساند.
- `database.rules.json` — ملف Rules الموجود في مستودع Test، وليس إثباتًا منفردًا لنسخة Console الحية.
- `src/firebase/roomService.js` — مسار 1v1 Create/Join.
- `src/firebase/gameSync.js` — مسارات synchronization وStart/Begin Round.
- `src/firebase/competitiveFirebase.js` — مسارات 2v2 وFour.

**ملاحظة:** لم تُجرَ أي عملية تعديل أو نشر أثناء إعداد هذا التقرير الموسع.
