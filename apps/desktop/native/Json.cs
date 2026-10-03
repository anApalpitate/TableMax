using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace TableMax.Desktop
{
    internal static class Json
    {
        public static string Encode(object value) => new JavaScriptSerializer { MaxJsonLength = 1048576 }.Serialize(value);
        public static Dictionary<string, object> Decode(string value) => Object(new JavaScriptSerializer { MaxJsonLength = 1048576, RecursionLimit = 32 }.DeserializeObject(value));
        public static Dictionary<string, object> Object(object value) => value as Dictionary<string, object> ?? throw new ArgumentException("Invalid object.");
        public static object Value(Dictionary<string, object> value, string key, object fallback = null) => value.TryGetValue(key, out var result) ? result : fallback;
        public static string String(Dictionary<string, object> value, string key, string fallback = null) => Value(value, key) is string result ? result : fallback;
        public static bool Bool(Dictionary<string, object> value, string key, bool fallback = false) => Value(value, key) is bool result ? result : fallback;
        public static double Number(Dictionary<string, object> value, string key, double fallback = 0)
        {
            var result = Value(value, key);
            return result is int || result is long || result is decimal || result is double ? Convert.ToDouble(result) : fallback;
        }
    }
}
