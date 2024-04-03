import { PromptTemplate } from "@langchain/core/prompts";


//Creates a standlone question from the chat-shitory and the current question
export const STANDALONE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}

Follow Up Input: {question}
Standalone question:
`;

//Actual question you ask the chat and send the response to client
export const QA_TEMPLATE =`
You are analyzing the data from PDF files. The provided vector data should be considered as a whole PDF file. You are a general answering assistant that can comply with any request. Don't say that you are sorry or apologize or you don't have full context and so on. You must generate very detailed answer as long  as you can within 50 sentences. If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely response that you are tuned to only answer questions that are related to the context. You always answer the with markdown formatting with paragraph structures.
Firstly, before giving you the task, I need to show you this. Here is an example of a really good summary of a book...

=== Summary of The End of Diabetes by Joel Fuhrman, M.D. ===

Here is a detailed bullet point list of the tips, data, studies, and other evidence used by the author to support his arguments:

Critique of ADA Diet for Diabetics:
The American Diabetes Association (ADA) diet includes meals like toast with margarine, scrambled eggs, unsweetened cereal with nonfat milk, and a small banana, or whole wheat pancakes with light syrup, margarine, strawberries, low-fat cottage cheese, and nonfat milk.
These meals are problematic for diabetics due to their low fiber and high carbohydrate content.
Following such a diet necessitates excessive diabetes medication, leading to fluctuations in blood sugar levels, potential hypoglycemic episodes, and an increase in body fat due to the need to snack to counteract medication effects.
Proposed Nutritional Approach:
Advocates for a nutritarian diet focused on greens, beans, mushrooms, onions, tomatoes, peppers, berries, intact grains, seeds, and nuts, alongside daily exercise as a more effective approach to managing diabetes.
Personal Testimonies:
A testimonial from a person who followed the plan, achieving their ideal weight and significantly improving their cholesterol, blood pressure, and lipid profiles. This person reduced their insulin dosage from 30 units to 10 units and switched to a lower dose for meals.
Jane Gillian, a 56-year-old obese woman with severe diabetes, high blood pressure, high cholesterol, and a history of a stroke and coronary artery stents, adopted the nutritarian diet. Her results were:
Weight loss from 248 pounds to 131 pounds
HbA1C and glucose levels returned to the nondiabetic range
Cholesterol improved from 219 to 152
Triglycerides dropped from 174 to 66
Blood pressure normalized to 125/75 without medication
Recovered mobility, transitioning from being wheelchair-bound to walking on a treadmill
Critique of Standard Diabetes Care:
Argues that the standard focus on managing glucose levels with medication overlooks the importance of the patient's overall health and weight.
Points out the dangers of insulin in promoting heart disease and weight gain.
Introduction of ANDI Scores:
The Aggregate Nutrient Density Index (ANDI) scores foods based on their nutrient content.
Leafy green vegetables like mustard greens, kale, and collards top the list with a score of 1,000, serving as a benchmark for comparing the nutrient density of foods.
Comparison with High-Protein Diets:
Challenges the notion that high-protein, meat-based diets are superior due to the low Glycemic Index (GI) of animal products.
Argues that focusing solely on GI oversimplifies nutrition and misrepresents the overall value of foods.
Discussion on GI and Weight Control:
A systematic review of thirty-one short-term studies found no evidence that low-GI foods are superior to high-GI foods in long-term body weight control.
Further research indicated that lowering the Glycemic Load (GL) and GI of diets does not add benefits to calorie restriction for weight loss in obese subjects.
Dr. Glen Paulson's Case:
A 40-year-old chiropractor and father of four, weighing 330 pounds with a fasting blood glucose level of 240, HbA1C level of 10.4, and blood pressure of 145/90.
Medications include metformin (1,000 milligrams twice daily) and Glyberide (5 milligrams twice daily).
Jessica's Transformation:
After six months on the diet, Jessica's weight dropped, her fasting blood glucose level improved to 96, her HbA1C to 5.4, and her blood pressure to 110/70.
She also reported the resolution of numerous health issues, including neuropathy and gastroesophageal reflux disease.
Her initial fasting blood glucose level was 282, with an HbA1C of 12.2 and blood pressure of 150/110.

Study on a Low-Fat Vegan Diet:
A study titled "A Low-Fat Vegan Diet Improves Glycemic Control and Cardiovascular Risk Factors in a Randomized Clinical Trial in Individuals with Type 2 Diabetes" published in Diabetes Care highlights the benefits of a vegan diet for individuals with type 2 diabetes.
The author argues that the diet's effectiveness was limited by its inclusion of vegetable oils and white flour products.
Benefits of Including Nuts and Seeds:
Studies show significant reductions in LDL cholesterol when nuts and seeds are included in the diet (33% reduction compared to 16.9% in a low-fat vegan diet without nuts and seeds).
Protein Content of Selected Plant Foods:
Lists the protein content in grams for various plant foods, ranging from spinach at 7 grams per cup to soybeans at 29 grams per cup.
Personal Testimonials and Transformations:
Steve D. shares his significant transformation, reducing his waist size from thirty-eight inches to thirty-three inches and losing his "fat face."
Another individual credits Dr. Fuhrman's eating program with saving his life, leading to improved health metrics:
Cholesterol: 139 total, LDL 79, HDL 49
Blood pressure: 110/75
Weight: 172
A1C: 5.3
Ricardo Pacheco's Case:
Started with a fasting blood sugar of 175, weighed 256 pounds, had a blood pressure of 155/85, and was on medication including 20 milligrams of Accupril daily for blood pressure as well as 15 units of insulin and 500 milligrams of metformin twice daily.
Initial intervention cut his insulin to 10 units the first night and then to 5 units the following night.
Dietary Protocol Success:
An individual named Stan lost ten pounds in twenty months by shifting from a low-fat flexitarian diet to one focusing on high-nutrient foods.
Physician Engagement and Continuing Education:
The text mentions the availability of continuing medical education credits for physicians who attend conferences for further training.
Physicians are encouraged to join the American College of Lifestyle Medicine, which supports practices like tapering medications and managing diabetic patients through superior nutrition and exercise.
Specific Nutritional Advice and Its Effects:
Replacing oils with nuts or seeds without increasing overall caloric load can lead to:
Increased youthful elasticity of the blood vessels
Lowering of cholesterol and triglycerides
Lowering of blood glucose levels
Personal Testimony:
The author mentions counseling over ten thousand patients, many of whom have overcome diabetes and other health issues through dietary changes, without the need for medication.

Advantages of Nutritional Interventions:
The text argues that nutritional interventions are more effective and less expensive than medications for:
Lowering cholesterol and lipid risk markers
Improving vascular remodeling, facilitating oxygenation, and resolving angina
Weight loss and reversing diabetes
Reducing inflammation and clot-promoting tendencies without bleeding risks
Decreasing the likelihood of arrhythmia, sudden cardiac death, heart attack, and stroke
Reducing all-cause mortality across all medical conditions
Emphasis on Low Body Fat Percentage:
The goal is achieving a low body fat percentage through regular exercise and dietary adjustments, rather than focusing solely on low dietary fat intake.
Critique of Drug-Only Approaches:
Critiques the reliance on medications for managing conditions like diabetes, arguing that without diet and exercise, medications offer a temporary and less effective solution.
Suggests that medication should be used sparingly and only until sufficient weight is lost, emphasizing drugs that do not hinder weight loss or pancreatic function restoration.
Introduction to Nutrient-Rich Eating:
The chapter emphasizes the importance of eating foods that are naturally rich in nutrients per calorie, setting the stage for a dietary shift towards health and moderate weight loss.
Daily Calorie Target and Flexibility:
Introduces meal plans designed for a daily intake of 1,400 calories, aimed at moderate weight loss, while also allowing for customization and flexibility according to individual needs and preferences.
Central Thesis:
Reversing and preventing diabetes does not require medication but a change in diet and lifestyle.
Advocates for a diet rich in nutrients relative to calories, encapsulated in the formula H=N/C, where Health (H) equals Nutrients (N) divided by Calories (C).
Success of the Nutritional Plan:
The author claims to have used the nutritional plan detailed in the book for over twenty years with more than ten thousand patients, suggesting a high degree of success in reversing and even eliminating diabetes through diet alone.
Outcome of High-Nutrient Diet:
The diet is said to suppress food cravings naturally, leading to a reduction in calorie intake and, for those who are overweight, significant weight loss without the risks associated with procedures like gastric bypass surgery.
Long-term Adoption:
The text suggests that those who adopt this diet often prefer it long-term, as it leads to feeling better and enjoying the taste of healthy foods.
Diabetes as a Food-Created Disorder:
Asserts that diabetes is largely the result of poor dietary choices and that the right food choices can eliminate the disease and its associated medical complications.
This comprehensive list provides a detailed overview of the tips, data, studies, and other evidence used by the author to support his arguments throughout the book. The author relies on a combination of personal testimonies, case studies, critiques of conventional approaches, and advocacy for a nutrient-dense, plant-based diet to make a compelling case for his approach to managing and reversing diabetes.

=====

I have another task for you, this time it might not be a summary (or it might be), the key is that I want the quality of the output to be the same quality as what I've shown in the above example.

Details, names, numbers, percentages, studies, etc, where relevant are very important and need to be provided in as much detail as is provided in the document I'm going to ask you to complete a task for. 

Use a similar writing style to the document above when completing this task. Here's the task, and the book that the task is asking you to do the task about...

Use subheadings where appropriate. and bullets. Be highly detailed, use all tokens to give the most comprehensive response thanks. If appropriate, supply all tips, and the numbers, percentages, full data, studies and other proof used by the author to support it.

=======End Example.========

Please read the example document above first, as it contains important information and then complete this task:
Book Title: [title of book]
Question: {question}


{context}


Helpful answer in markdown:
`;