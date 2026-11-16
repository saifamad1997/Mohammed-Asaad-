using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;

namespace MohammedAsaad.CadBridge
{
    public class DesignDraftCommands
    {
        private const string Protocol = "mo-asaad.cad-bridge";

        [CommandMethod("MA_IMPORT_DRAFT")]
        public void ImportDesignDraft()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc.Editor;
            var options = new PromptOpenFileOptions("\nاختر ملف مسودة المهندس JSON:")
            {
                Filter = "JSON files (*.json)|*.json",
                DialogCaption = "محمد أسعد — استيراد مسودة المهندس"
            };
            var result = ed.GetFileNameForOpen(options);
            if (result.Status != PromptStatus.OK) return;

            try
            {
                using JsonDocument json = JsonDocument.Parse(File.ReadAllText(result.StringResult));
                JsonElement root = json.RootElement;
                if (GetString(root, "protocol") != Protocol || GetInt(root, "version") != 1)
                    throw new InvalidDataException("إصدار بروتوكول المسودة غير مدعوم.");

                JsonElement design = root.GetProperty("design");
                JsonElement components = design.GetProperty("components");
                if (components.ValueKind != JsonValueKind.Array)
                    throw new InvalidDataException("قائمة العناصر غير صالحة.");

                using Transaction tr = doc.Database.TransactionManager.StartTransaction();
                BlockTable bt = (BlockTable)tr.GetObject(doc.Database.BlockTableId, OpenMode.ForRead);
                BlockTableRecord space = (BlockTableRecord)tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForWrite);
                double cursorX = 0;
                const double gap = 100;
                int created = 0, skipped = 0;

                foreach (JsonElement item in components.EnumerateArray())
                {
                    try
                    {
                        JsonElement dims = item.GetProperty("dimensions");
                        double width = Positive(dims, "width");
                        double depth = Positive(dims, "depth");
                        double height = Positive(dims, "height");
                        using (Solid3d solid = new Solid3d())
                        {
                            solid.CreateBox(width, depth, height);
                            solid.TransformBy(Matrix3d.Displacement(new Vector3d(cursorX, 0, 0)));
                            solid.SetDatabaseDefaults(doc.Database);
                            solid.Layer = "0";
                            space.AppendEntity(solid);
                            tr.AddNewlyCreatedDBObject(solid, true);
                        }
                        string label = GetString(item, "name") ?? GetString(item, "role") ?? "عنصر";
                        using (DBText text = new DBText())
                        {
                            text.SetDatabaseDefaults(doc.Database);
                            text.Position = new Point3d(cursorX, -150, 0);
                            text.Height = Math.Max(20, Math.Min(width, depth) * 0.04);
                            text.TextString = label.Length > 60 ? label.Substring(0, 60) : label;
                            space.AppendEntity(text);
                            tr.AddNewlyCreatedDBObject(text, true);
                        }
                        cursorX += width + gap;
                        created++;
                    }
                    catch
                    {
                        skipped++;
                    }
                }

                if (created == 0) throw new InvalidDataException("لا توجد عناصر مكتملة العرض والعمق والارتفاع لإنشاء مجسمات.");
                tr.Commit();
                ed.WriteMessage($"\nتم إنشاء {created} مجسم أولي. العناصر المتجاوزة بسبب نقص الأبعاد: {skipped}.");
                ed.WriteMessage("\nهذه كتل تصورية منفصلة وليست تجميعاً أو رسماً معتمداً للتصنيع.");
            }
            catch (System.Exception ex)
            {
                ed.WriteMessage("\nتعذر استيراد المسودة: " + ex.Message);
            }
        }

        private static double Positive(JsonElement element, string key)
        {
            if (!element.TryGetProperty(key, out JsonElement value) ||
                value.ValueKind != JsonValueKind.Number ||
                !value.TryGetDouble(out double number) ||
                !double.IsFinite(number) || number <= 0)
                throw new InvalidDataException("البعد " + key + " مفقود أو غير صالح.");
            return number;
        }

        private static string GetString(JsonElement element, string key)
        {
            return element.TryGetProperty(key, out JsonElement value) && value.ValueKind == JsonValueKind.String
                ? value.GetString() : null;
        }

        private static int GetInt(JsonElement element, string key)
        {
            return element.TryGetProperty(key, out JsonElement value) && value.TryGetInt32(out int number) ? number : 0;
        }
    }
}
